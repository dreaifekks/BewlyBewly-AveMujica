import browser from 'webextension-polyfill'

import type {
  AccountIdentityInput,
  AccountListResult,
  AccountLoginResult,
  AccountManagerErrorCode,
  AccountManagerRequest,
  AccountManagerResponse,
  AccountSwitchResult,
  MobileCredentialInput,
} from '~/types/accountManager'
import { ACCOUNT_MANAGER_CHANNEL } from '~/types/accountManager'

type WithoutChannel<T> = T extends unknown ? Omit<T, 'channel'> : never
type AccountManagerPayload = WithoutChannel<AccountManagerRequest>

export class AccountManagerClientError extends Error {
  constructor(
    readonly code: AccountManagerErrorCode,
    message: string,
  ) {
    super(message)
  }
}

async function sendAccountRequest<T>(
  request: AccountManagerPayload,
): Promise<T> {
  const response = await browser.runtime.sendMessage({
    ...request,
    channel: ACCOUNT_MANAGER_CHANNEL,
  }) as AccountManagerResponse<T> | undefined

  if (!response)
    throw new AccountManagerClientError('INVALID_REQUEST', 'The account manager did not respond')
  if (!response.ok)
    throw new AccountManagerClientError(response.error.code, response.error.message)
  return response.data
}

export function registerCurrentAccount(identity: AccountIdentityInput): Promise<AccountListResult> {
  return sendAccountRequest<AccountListResult>({
    action: 'registerCurrentAccount',
    identity,
  })
}

export function switchAccount(uid: string, url: string): Promise<AccountSwitchResult> {
  return sendAccountRequest<AccountSwitchResult>({
    action: 'switchAccount',
    uid,
    url,
  })
}

export function startAddAccount(): Promise<AccountLoginResult> {
  return sendAccountRequest<AccountLoginResult>({
    action: 'startAddAccount',
  })
}

export async function getCurrentMobileToken(): Promise<string | null> {
  try {
    return await sendAccountRequest<string | null>({
      action: 'getCurrentMobileToken',
    })
  }
  catch (error) {
    console.error('[AccountManager] Failed to resolve the current mobile token:', error)
    return null
  }
}

export function setCurrentMobileCredential(
  credential: MobileCredentialInput,
): Promise<void> {
  return sendAccountRequest<void>({
    action: 'setCurrentMobileCredential',
    credential,
  })
}

export function clearCurrentMobileCredential(): Promise<void> {
  return sendAccountRequest<void>({
    action: 'clearCurrentMobileCredential',
  })
}

export function removeAccount(uid: string): Promise<void> {
  return sendAccountRequest<void>({
    action: 'removeAccount',
    uid,
  })
}
