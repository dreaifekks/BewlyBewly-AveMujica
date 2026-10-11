export const ACCOUNT_MANAGER_CHANNEL = 'bewly-account-manager'
export const ACCOUNT_VAULT_KEY = 'bewly-account-vault-v1'
export const LEGACY_ACCESS_KEY = 'accessKey'

export interface StoredBilibiliCookie {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  hostOnly: boolean
  session: boolean
  sameSite?: string
  expirationDate?: number
  firstPartyDomain?: string
}

export interface MobileCredential {
  accessToken: string
  obtainedAt: number
  expiresAt: number | null
}

export interface StoredAccountProfile {
  uid: string
  uname: string
  avatar: string
  cookieStoreId: string | null
  cookies: StoredBilibiliCookie[]
  mobileCredential: MobileCredential | null
  createdAt: number
  updatedAt: number
  lastSeenAt: number
  lastActivatedAt: number | null
}

export interface AccountVault {
  version: 1
  accounts: Record<string, StoredAccountProfile>
  activeUidByCookieStore: Record<string, string>
  legacyAccessKeyMigrated: boolean
}

export interface AccountIdentityInput {
  uid: string
  uname: string
  avatar: string
}

export interface MobileCredentialInput {
  uid: string
  accessToken: string
  expiresIn?: number | null
}

export interface PublicAccountProfile {
  uid: string
  uname: string
  avatar: string
  current: boolean
  hasMobileToken: boolean
}

export interface AccountListResult {
  accounts: PublicAccountProfile[]
}

export interface AccountSwitchResult {
  openedReplacementTab: boolean
}

export interface AccountLoginResult {
  currentSessionCleared: boolean
}

export type AccountManagerErrorCode =
  | 'ACCOUNT_NOT_FOUND'
  | 'COOKIE_RESTORE_FAILED'
  | 'CURRENT_ACCOUNT_REQUIRED'
  | 'INVALID_REQUEST'
  | 'MOBILE_ACCOUNT_MISMATCH'
  | 'SWITCH_FAILED'

export type AccountManagerRequest =
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'registerCurrentAccount', identity: AccountIdentityInput }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'switchAccount', uid: string, url: string }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'startAddAccount' }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'getCurrentMobileToken' }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'setCurrentMobileCredential', credential: MobileCredentialInput }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'clearCurrentMobileCredential' }
  | { channel: typeof ACCOUNT_MANAGER_CHANNEL, action: 'removeAccount', uid: string }

export type AccountManagerResponse<T = unknown> =
  | { ok: true, data: T }
  | { ok: false, error: { code: AccountManagerErrorCode, message: string } }
