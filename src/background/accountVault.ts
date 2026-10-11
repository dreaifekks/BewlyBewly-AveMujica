import type {
  AccountIdentityInput,
  AccountVault,
  MobileCredentialInput,
  PublicAccountProfile,
  StoredAccountProfile,
  StoredBilibiliCookie,
} from '~/types/accountManager'

export function createEmptyAccountVault(): AccountVault {
  return {
    version: 1,
    accounts: {},
    activeUidByCookieStore: {},
    legacyAccessKeyMigrated: false,
  }
}

export function normalizeAccountVault(value: unknown): AccountVault {
  if (!value || typeof value !== 'object')
    return createEmptyAccountVault()

  const candidate = value as Partial<AccountVault>
  if (candidate.version !== 1)
    return createEmptyAccountVault()

  return {
    version: 1,
    accounts: candidate.accounts && typeof candidate.accounts === 'object' ? candidate.accounts : {},
    activeUidByCookieStore: candidate.activeUidByCookieStore && typeof candidate.activeUidByCookieStore === 'object'
      ? candidate.activeUidByCookieStore
      : {},
    legacyAccessKeyMigrated: candidate.legacyAccessKeyMigrated === true,
  }
}

export function isFirefoxContainerStore(cookieStoreId: string | null | undefined): boolean {
  return Boolean(cookieStoreId?.startsWith('firefox-container-'))
}

export function upsertObservedAccount(
  vault: AccountVault,
  identity: AccountIdentityInput,
  cookies: StoredBilibiliCookie[],
  observedCookieStoreId: string,
  now: number,
): StoredAccountProfile {
  const existing = vault.accounts[identity.uid]
  const preserveDedicatedContainer = existing
    && isFirefoxContainerStore(existing.cookieStoreId)
    && !isFirefoxContainerStore(observedCookieStoreId)
  const cookieStoreId = preserveDedicatedContainer ? existing.cookieStoreId : observedCookieStoreId

  const account: StoredAccountProfile = {
    uid: identity.uid,
    uname: identity.uname || existing?.uname || identity.uid,
    avatar: identity.avatar || existing?.avatar || '',
    cookieStoreId,
    cookies,
    mobileCredential: existing?.mobileCredential ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastSeenAt: now,
    lastActivatedAt: existing?.lastActivatedAt ?? null,
  }

  vault.accounts[identity.uid] = account
  vault.activeUidByCookieStore[observedCookieStoreId] = identity.uid
  return account
}

export function attachMobileCredential(
  vault: AccountVault,
  input: MobileCredentialInput,
  now: number,
): StoredAccountProfile | null {
  const account = vault.accounts[input.uid]
  if (!account)
    return null

  const expiresIn = typeof input.expiresIn === 'number' && input.expiresIn > 0
    ? input.expiresIn
    : null
  account.mobileCredential = {
    accessToken: input.accessToken,
    obtainedAt: now,
    expiresAt: expiresIn === null ? null : now + expiresIn * 1000,
  }
  account.updatedAt = now
  return account
}

export function migrateLegacyMobileCredential(
  vault: AccountVault,
  currentUid: string,
  legacyAccessKey: unknown,
  now: number,
): boolean {
  if (vault.legacyAccessKeyMigrated)
    return false

  const account = vault.accounts[currentUid]
  if (!account)
    return false

  if (
    Object.keys(vault.accounts).length === 1
    && typeof legacyAccessKey === 'string'
    && legacyAccessKey.length > 0
    && !account.mobileCredential
  ) {
    attachMobileCredential(vault, {
      uid: currentUid,
      accessToken: legacyAccessKey,
    }, now)
  }

  vault.legacyAccessKeyMigrated = true
  return true
}

export function clearMobileCredential(vault: AccountVault, uid: string, now: number): boolean {
  const account = vault.accounts[uid]
  if (!account)
    return false

  account.mobileCredential = null
  account.updatedAt = now
  return true
}

export function setAccountCookieStore(
  vault: AccountVault,
  uid: string,
  cookieStoreId: string,
  now: number,
): StoredAccountProfile | null {
  const account = vault.accounts[uid]
  if (!account)
    return null

  account.cookieStoreId = cookieStoreId
  account.updatedAt = now
  return account
}

export function toPublicAccount(
  account: StoredAccountProfile,
  currentUid: string | null,
): PublicAccountProfile {
  return {
    uid: account.uid,
    uname: account.uname,
    avatar: account.avatar,
    current: account.uid === currentUid,
    hasMobileToken: Boolean(account.mobileCredential?.accessToken),
  }
}

export function listPublicAccounts(
  vault: AccountVault,
  currentUid: string | null,
): PublicAccountProfile[] {
  return Object.values(vault.accounts)
    .filter(account => account.cookies.length > 0)
    .sort((left, right) => {
      if ((left.uid === currentUid) !== (right.uid === currentUid))
        return left.uid === currentUid ? -1 : 1
      return (right.lastActivatedAt ?? right.lastSeenAt) - (left.lastActivatedAt ?? left.lastSeenAt)
    })
    .map(account => toPublicAccount(account, currentUid))
}

export function getCurrentMobileToken(vault: AccountVault, currentUid: string | null): string | null {
  if (!currentUid)
    return null
  return vault.accounts[currentUid]?.mobileCredential?.accessToken ?? null
}
