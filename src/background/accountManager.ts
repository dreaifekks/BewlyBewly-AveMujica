import type Browser from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import type {
  AccountIdentityInput,
  AccountListResult,
  AccountLoginResult,
  AccountManagerErrorCode,
  AccountManagerRequest,
  AccountManagerResponse,
  AccountSwitchResult,
  AccountVault,
  StoredAccountProfile,
} from '~/types/accountManager'
import {
  ACCOUNT_MANAGER_CHANNEL,
  ACCOUNT_VAULT_KEY,
  LEGACY_ACCESS_KEY,
} from '~/types/accountManager'

import {
  BILIBILI_HOME_URL,
  captureBilibiliCookies,
  clearBilibiliCookies,
  getBilibiliUid,
  getSenderCookieStoreId,
  replaceBilibiliCookiesWithRollback,
  restoreBilibiliCookies,
} from './accountCookies'
import { reloadSiblingBilibiliTabs } from './accountTabs'
import {
  attachMobileCredential,
  clearMobileCredential,
  getCurrentMobileToken,
  isFirefoxContainerStore,
  listPublicAccounts,
  migrateLegacyMobileCredential,
  normalizeAccountVault,
  setAccountCookieStore,
  upsertObservedAccount,
} from './accountVault'

// eslint-disable-next-line node/prefer-global/process
const IS_FIREFOX = Boolean(process.env.FIREFOX)

interface FirefoxContextualIdentity {
  cookieStoreId: string
}

interface FirefoxContextualIdentitiesApi {
  create: (details: { name: string, color: string, icon: string }) => Promise<FirefoxContextualIdentity>
  remove: (cookieStoreId: string) => Promise<void>
}

type ExtendedBrowser = typeof browser & {
  contextualIdentities?: FirefoxContextualIdentitiesApi
}

const extendedBrowser = browser as ExtendedBrowser

class AccountManagerError extends Error {
  constructor(
    readonly code: AccountManagerErrorCode,
    message: string,
  ) {
    super(message)
  }
}

// Serialize whole-vault read-modify-write transactions from concurrent tabs and containers.
let vaultQueue: Promise<void> = Promise.resolve()

function withVaultLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = vaultQueue.then(operation, operation)
  vaultQueue = result.then(() => undefined, () => undefined)
  return result
}

async function readVault(): Promise<AccountVault> {
  const stored = await browser.storage.local.get(ACCOUNT_VAULT_KEY)
  return normalizeAccountVault(stored[ACCOUNT_VAULT_KEY])
}

async function writeVault(vault: AccountVault): Promise<void> {
  await browser.storage.local.set({ [ACCOUNT_VAULT_KEY]: vault })
}

async function migrateLegacyAccessKey(
  vault: AccountVault,
  currentUid: string,
  now: number,
): Promise<boolean> {
  if (vault.legacyAccessKeyMigrated)
    return false

  const stored = await browser.storage.local.get(LEGACY_ACCESS_KEY)
  return migrateLegacyMobileCredential(
    vault,
    currentUid,
    stored[LEGACY_ACCESS_KEY],
    now,
  )
}

async function createDedicatedContainer(account: StoredAccountProfile): Promise<string | null> {
  const api = extendedBrowser.contextualIdentities
  if (!IS_FIREFOX || !api)
    return null

  const identity = await api.create({
    name: 'Bili · '.concat(account.uname || account.uid),
    color: 'blue',
    icon: 'fingerprint',
  })

  try {
    await restoreBilibiliCookies(account.cookies, identity.cookieStoreId)
    const restoredUid = await getBilibiliUid(identity.cookieStoreId)
    if (restoredUid !== account.uid)
      throw new Error('Dedicated container verification failed')
    return identity.cookieStoreId
  }
  catch (error) {
    await api.remove(identity.cookieStoreId).catch(() => undefined)
    throw error
  }
}

async function ensureFirefoxContainerIsolation(
  vault: AccountVault,
  observedCookieStoreId: string,
  now: number,
): Promise<void> {
  if (
    !IS_FIREFOX
    || observedCookieStoreId.includes('private')
    || Object.values(vault.accounts).filter(account => account.cookies.length > 0).length < 2
  ) {
    return
  }

  for (const account of Object.values(vault.accounts)) {
    if (!account.cookies.length || isFirefoxContainerStore(account.cookieStoreId))
      continue

    try {
      const containerStoreId = await createDedicatedContainer(account)
      if (containerStoreId)
        setAccountCookieStore(vault, account.uid, containerStoreId, now)
    }
    catch (error) {
      console.error('[AccountManager] Failed to isolate account in a Firefox container:', error)
    }
  }
}

async function registerCurrentAccount(
  identity: AccountIdentityInput,
  sender: Browser.Runtime.MessageSender,
): Promise<AccountListResult> {
  return withVaultLock(async () => {
    const cookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(cookieStoreId)
    if (!currentUid)
      throw new AccountManagerError('CURRENT_ACCOUNT_REQUIRED', 'No logged-in Bilibili account was found')
    if (currentUid !== identity.uid)
      throw new AccountManagerError('INVALID_REQUEST', 'The page identity does not match its Cookie account')

    const [cookies, vault] = await Promise.all([
      captureBilibiliCookies(cookieStoreId),
      readVault(),
    ])
    const now = Date.now()
    upsertObservedAccount(
      vault,
      identity,
      cookies,
      cookieStoreId,
      now,
    )
    const legacyAccessKeyHandled = await migrateLegacyAccessKey(vault, currentUid, now)
    await ensureFirefoxContainerIsolation(vault, cookieStoreId, now)
    await writeVault(vault)
    if (legacyAccessKeyHandled) {
      await browser.storage.local.remove(LEGACY_ACCESS_KEY).catch(error =>
        console.error('[AccountManager] Failed to remove the handled legacy token:', error))
    }

    return {
      accounts: listPublicAccounts(vault, currentUid),
    }
  })
}

function safeSwitchUrl(requestedUrl: string, sender: Browser.Runtime.MessageSender): string {
  for (const candidate of [sender.tab?.url, requestedUrl]) {
    if (!candidate)
      continue
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' && (url.hostname === 'bilibili.com' || url.hostname.endsWith('.bilibili.com')))
        return url.toString()
    }
    catch {
      // Use the safe fallback below.
    }
  }
  return BILIBILI_HOME_URL
}

async function createReplacementContainerTab(
  cookieStoreId: string,
  url: string,
  sender: Browser.Runtime.MessageSender,
): Promise<number> {
  const createProperties: Parameters<typeof browser.tabs.create>[0] & { cookieStoreId: string } = {
    url,
    active: true,
    cookieStoreId,
  }
  if (sender.tab?.windowId !== undefined)
    createProperties.windowId = sender.tab.windowId
  if (sender.tab?.index !== undefined)
    createProperties.index = sender.tab.index + 1

  const replacement = await browser.tabs.create(createProperties)
  if (replacement.id === undefined)
    throw new Error('The replacement tab could not be created')
  return replacement.id
}

async function switchAccount(
  uid: string,
  requestedUrl: string,
  sender: Browser.Runtime.MessageSender,
): Promise<AccountSwitchResult> {
  return withVaultLock(async () => {
    const vault = await readVault()
    const target = vault.accounts[uid]
    if (!target || !target.cookies.length)
      throw new AccountManagerError('ACCOUNT_NOT_FOUND', 'The selected account has no saved Cookie session')

    const currentCookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(currentCookieStoreId)
    if (currentUid === uid) {
      return {
        openedReplacementTab: false,
      }
    }

    if (currentUid && vault.accounts[currentUid]) {
      const currentAccount = vault.accounts[currentUid]
      currentAccount.cookies = await captureBilibiliCookies(currentCookieStoreId)
      currentAccount.updatedAt = Date.now()
      currentAccount.lastSeenAt = Date.now()
      vault.activeUidByCookieStore[currentCookieStoreId] = currentUid
    }

    const targetCookieStoreId = target.cookieStoreId || currentCookieStoreId
    if (IS_FIREFOX && targetCookieStoreId !== currentCookieStoreId) {
      const containerUid = await getBilibiliUid(targetCookieStoreId)
      const replacedTargetCookies = containerUid !== uid
      target.lastActivatedAt = Date.now()
      target.updatedAt = Date.now()
      vault.activeUidByCookieStore[targetCookieStoreId] = uid
      let replacementTabId: number | undefined
      const commitSwitch = async () => {
        replacementTabId = await createReplacementContainerTab(
          targetCookieStoreId,
          safeSwitchUrl(requestedUrl, sender),
          sender,
        )
        await writeVault(vault)
      }
      try {
        if (replacedTargetCookies) {
          await replaceBilibiliCookiesWithRollback(
            target.cookies,
            uid,
            targetCookieStoreId,
            commitSwitch,
          )
        }
        else {
          await commitSwitch()
        }
      }
      catch (error) {
        if (replacementTabId !== undefined)
          await browser.tabs.remove(replacementTabId).catch(() => undefined)
        throw error
      }
      if (replacedTargetCookies) {
        await reloadSiblingBilibiliTabs(
          sender,
          targetCookieStoreId,
          IS_FIREFOX,
          replacementTabId === undefined ? [] : [replacementTabId],
        )
      }
      if (sender.tab?.id !== undefined)
        await browser.tabs.remove(sender.tab.id).catch(() => undefined)
      return {
        openedReplacementTab: true,
      }
    }

    target.lastActivatedAt = Date.now()
    target.updatedAt = Date.now()
    vault.activeUidByCookieStore[currentCookieStoreId] = uid
    let vaultCommitStarted = false
    try {
      await replaceBilibiliCookiesWithRollback(
        target.cookies,
        uid,
        currentCookieStoreId,
        async () => {
          vaultCommitStarted = true
          await writeVault(vault)
        },
      )
    }
    catch (error) {
      if (vaultCommitStarted)
        throw error
      throw new AccountManagerError(
        'COOKIE_RESTORE_FAILED',
        error instanceof Error ? error.message : String(error),
      )
    }
    await reloadSiblingBilibiliTabs(sender, currentCookieStoreId, IS_FIREFOX)

    return {
      openedReplacementTab: false,
    }
  })
}

async function startAddAccount(
  sender: Browser.Runtime.MessageSender,
): Promise<AccountLoginResult> {
  return withVaultLock(async () => {
    const currentCookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(currentCookieStoreId)
    const vault = await readVault()
    let currentCookies: StoredAccountProfile['cookies'] = []

    if (currentUid) {
      currentCookies = await captureBilibiliCookies(currentCookieStoreId)
      const currentAccount = vault.accounts[currentUid]
      if (currentAccount) {
        currentAccount.cookies = currentCookies
        currentAccount.updatedAt = Date.now()
        currentAccount.lastSeenAt = Date.now()
      }
      else {
        upsertObservedAccount(vault, {
          uid: currentUid,
          uname: currentUid,
          avatar: '',
        }, currentCookies, currentCookieStoreId, Date.now())
      }
      vault.activeUidByCookieStore[currentCookieStoreId] = currentUid
      await writeVault(vault)
    }

    const loginUrl = 'https://passport.bilibili.com/login'
    if (IS_FIREFOX && extendedBrowser.contextualIdentities) {
      const identity = await extendedBrowser.contextualIdentities.create({
        name: 'Bili · New account',
        color: 'blue',
        icon: 'fingerprint',
      })
      try {
        const createProperties: Parameters<typeof browser.tabs.create>[0] & { cookieStoreId: string } = {
          url: loginUrl,
          active: true,
          cookieStoreId: identity.cookieStoreId,
        }
        if (sender.tab?.windowId !== undefined)
          createProperties.windowId = sender.tab.windowId
        if (sender.tab?.index !== undefined)
          createProperties.index = sender.tab.index + 1
        await browser.tabs.create(createProperties)
      }
      catch (error) {
        await extendedBrowser.contextualIdentities.remove(identity.cookieStoreId).catch(() => undefined)
        throw error
      }
      return { currentSessionCleared: false }
    }

    try {
      if (currentUid) {
        await clearBilibiliCookies(currentCookieStoreId)
        await reloadSiblingBilibiliTabs(sender, currentCookieStoreId, IS_FIREFOX)
      }

      const createProperties: Parameters<typeof browser.tabs.create>[0] = {
        url: loginUrl,
        active: true,
      }
      if (sender.tab?.windowId !== undefined)
        createProperties.windowId = sender.tab.windowId
      if (sender.tab?.index !== undefined)
        createProperties.index = sender.tab.index + 1
      await browser.tabs.create(createProperties)
    }
    catch (error) {
      if (currentUid && currentCookies.length) {
        await restoreBilibiliCookies(currentCookies, currentCookieStoreId)
        await reloadSiblingBilibiliTabs(sender, currentCookieStoreId, IS_FIREFOX)
      }
      throw error
    }
    return { currentSessionCleared: Boolean(currentUid) }
  })
}

async function currentMobileToken(sender: Browser.Runtime.MessageSender): Promise<string | null> {
  return withVaultLock(async () => {
    const cookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(cookieStoreId)
    if (!currentUid)
      return null

    const vault = await readVault()
    const now = Date.now()
    let shouldWriteVault = false

    if (!vault.accounts[currentUid]) {
      const cookies = await captureBilibiliCookies(cookieStoreId)
      upsertObservedAccount(vault, {
        uid: currentUid,
        uname: currentUid,
        avatar: '',
      }, cookies, cookieStoreId, now)
      shouldWriteVault = true
    }

    const legacyAccessKeyHandled = await migrateLegacyAccessKey(vault, currentUid, now)
    if (legacyAccessKeyHandled)
      shouldWriteVault = true
    if (shouldWriteVault)
      await writeVault(vault)
    if (legacyAccessKeyHandled) {
      await browser.storage.local.remove(LEGACY_ACCESS_KEY).catch(error =>
        console.error('[AccountManager] Failed to remove the handled legacy token:', error))
    }

    return getCurrentMobileToken(vault, currentUid)
  })
}

async function saveCurrentMobileCredential(
  request: Extract<AccountManagerRequest, { action: 'setCurrentMobileCredential' }>,
  sender: Browser.Runtime.MessageSender,
): Promise<void> {
  return withVaultLock(async () => {
    const cookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(cookieStoreId)
    if (!currentUid)
      throw new AccountManagerError('CURRENT_ACCOUNT_REQUIRED', 'Log in before authorizing the mobile account')
    if (currentUid !== request.credential.uid) {
      throw new AccountManagerError(
        'MOBILE_ACCOUNT_MISMATCH',
        'The scanned mobile account does not match the current web account',
      )
    }

    const vault = await readVault()
    const now = Date.now()
    if (!vault.accounts[currentUid]) {
      const cookies = await captureBilibiliCookies(cookieStoreId)
      upsertObservedAccount(vault, {
        uid: currentUid,
        uname: currentUid,
        avatar: '',
      }, cookies, cookieStoreId, now)
    }
    const account = attachMobileCredential(vault, request.credential, now)
    if (!account)
      throw new AccountManagerError('CURRENT_ACCOUNT_REQUIRED', 'The current account could not be registered')
    await writeVault(vault)
    await reloadSiblingBilibiliTabs(sender, cookieStoreId, IS_FIREFOX)
  })
}

async function clearCurrentMobileToken(
  sender: Browser.Runtime.MessageSender,
): Promise<void> {
  return withVaultLock(async () => {
    const cookieStoreId = getSenderCookieStoreId(sender)
    const currentUid = await getBilibiliUid(cookieStoreId)
    if (!currentUid)
      return

    const vault = await readVault()
    if (!clearMobileCredential(vault, currentUid, Date.now()))
      return
    await writeVault(vault)
    await reloadSiblingBilibiliTabs(sender, cookieStoreId, IS_FIREFOX)
  })
}

async function removeAccount(
  uid: string,
  sender: Browser.Runtime.MessageSender,
): Promise<void> {
  return withVaultLock(async () => {
    const vault = await readVault()
    const senderCookieStoreId = getSenderCookieStoreId(sender)
    const senderUid = await getBilibiliUid(senderCookieStoreId)
    if (
      senderUid !== uid
      && vault.activeUidByCookieStore[senderCookieStoreId] !== uid
    ) {
      throw new AccountManagerError(
        'INVALID_REQUEST',
        'Only the account associated with the current tab can be removed',
      )
    }

    const account = vault.accounts[uid]
    if (!account)
      return

    if (account.cookieStoreId) {
      const cookieUid = await getBilibiliUid(account.cookieStoreId)
      if (cookieUid === uid)
        await clearBilibiliCookies(account.cookieStoreId)
    }

    delete vault.accounts[uid]
    for (const [cookieStoreId, activeUid] of Object.entries(vault.activeUidByCookieStore)) {
      if (activeUid === uid)
        delete vault.activeUidByCookieStore[cookieStoreId]
    }
    await writeVault(vault)
    await reloadSiblingBilibiliTabs(sender, senderCookieStoreId, IS_FIREFOX)
  })
}

async function dispatchRequest(
  request: AccountManagerRequest,
  sender: Browser.Runtime.MessageSender,
): Promise<unknown> {
  switch (request.action) {
    case 'registerCurrentAccount':
      return registerCurrentAccount(request.identity, sender)
    case 'switchAccount':
      return switchAccount(request.uid, request.url, sender)
    case 'startAddAccount':
      return startAddAccount(sender)
    case 'getCurrentMobileToken':
      return currentMobileToken(sender)
    case 'setCurrentMobileCredential':
      return saveCurrentMobileCredential(request, sender)
    case 'clearCurrentMobileCredential':
      return clearCurrentMobileToken(sender)
    case 'removeAccount':
      return removeAccount(request.uid, sender)
  }
}

function isAccountManagerRequest(message: unknown): message is AccountManagerRequest {
  if (!message || typeof message !== 'object')
    return false
  const candidate = message as Partial<AccountManagerRequest>
  return candidate.channel === ACCOUNT_MANAGER_CHANNEL && typeof candidate.action === 'string'
}

function toErrorResponse(error: unknown): AccountManagerResponse<never> {
  if (error instanceof AccountManagerError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    }
  }
  return {
    ok: false,
    error: {
      code: 'SWITCH_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  }
}

function handleAccountManagerMessage(
  message: unknown,
  sender: Browser.Runtime.MessageSender,
): Promise<AccountManagerResponse> | undefined {
  if (!isAccountManagerRequest(message))
    return undefined

  return dispatchRequest(message, sender)
    .then(data => ({ ok: true, data }) as AccountManagerResponse)
    .catch(toErrorResponse)
}

export function setupAccountManager(): void {
  browser.runtime.onMessage.removeListener(handleAccountManagerMessage)
  browser.runtime.onMessage.addListener(handleAccountManagerMessage)
}
