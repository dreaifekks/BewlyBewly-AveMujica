import { describe, expect, it } from 'vitest'

import {
  attachMobileCredential,
  createEmptyAccountVault,
  getCurrentMobileToken,
  migrateLegacyMobileCredential,
  setAccountCookieStore,
  upsertObservedAccount,
} from '~/background/accountVault'
import type { StoredBilibiliCookie } from '~/types/accountManager'

function cookiesFor(uid: string): StoredBilibiliCookie[] {
  return [{
    name: 'DedeUserID',
    value: uid,
    domain: '.bilibili.com',
    path: '/',
    secure: true,
    httpOnly: false,
    hostOnly: false,
    session: false,
    sameSite: 'lax',
    expirationDate: 2_000_000_000,
  }]
}

describe('account vault', () => {
  it('keeps mobile credentials bound to their UID and returns null for tokenless users', () => {
    const vault = createEmptyAccountVault()
    upsertObservedAccount(vault, {
      uid: '100',
      uname: 'Alpha',
      avatar: 'alpha.png',
    }, cookiesFor('100'), '0', 1_000)
    upsertObservedAccount(vault, {
      uid: '200',
      uname: 'Beta',
      avatar: 'beta.png',
    }, cookiesFor('200'), '0', 2_000)

    attachMobileCredential(vault, {
      uid: '100',
      accessToken: 'alpha-token',
      expiresIn: 60,
    }, 3_000)

    expect(getCurrentMobileToken(vault, '100')).toBe('alpha-token')
    expect(getCurrentMobileToken(vault, '200')).toBeNull()
    expect(getCurrentMobileToken(vault, null)).toBeNull()
    expect(vault.accounts['100'].mobileCredential?.expiresAt).toBe(63_000)
  })

  it('preserves a dedicated Firefox container when the same account is observed in the default store', () => {
    const vault = createEmptyAccountVault()
    upsertObservedAccount(vault, {
      uid: '100',
      uname: 'Alpha',
      avatar: '',
    }, cookiesFor('100'), 'firefox-default', 1_000)
    setAccountCookieStore(vault, '100', 'firefox-container-7', 2_000)

    upsertObservedAccount(vault, {
      uid: '100',
      uname: 'Alpha updated',
      avatar: '',
    }, cookiesFor('100'), 'firefox-default', 3_000)

    expect(vault.accounts['100'].cookieStoreId).toBe('firefox-container-7')
    expect(vault.accounts['100'].uname).toBe('Alpha updated')
  })

  it('migrates a legacy token to the sole current account', () => {
    const vault = createEmptyAccountVault()
    upsertObservedAccount(vault, {
      uid: '100',
      uname: 'Alpha',
      avatar: '',
    }, cookiesFor('100'), '0', 1_000)

    expect(migrateLegacyMobileCredential(vault, '100', 'legacy-token', 2_000)).toBe(true)
    expect(getCurrentMobileToken(vault, '100')).toBe('legacy-token')
    expect(vault.legacyAccessKeyMigrated).toBe(true)
  })

  it('does not guess a legacy token owner when multiple accounts exist', () => {
    const vault = createEmptyAccountVault()
    upsertObservedAccount(vault, {
      uid: '100',
      uname: 'Alpha',
      avatar: '',
    }, cookiesFor('100'), '0', 1_000)
    upsertObservedAccount(vault, {
      uid: '200',
      uname: 'Beta',
      avatar: '',
    }, cookiesFor('200'), '0', 2_000)

    expect(migrateLegacyMobileCredential(vault, '100', 'unknown-owner-token', 3_000)).toBe(true)
    expect(getCurrentMobileToken(vault, '100')).toBeNull()
    expect(getCurrentMobileToken(vault, '200')).toBeNull()
    expect(vault.legacyAccessKeyMigrated).toBe(true)
  })

  it('waits to handle a legacy token until the current account is registered', () => {
    const vault = createEmptyAccountVault()

    expect(migrateLegacyMobileCredential(vault, '100', 'legacy-token', 1_000)).toBe(false)
    expect(vault.legacyAccessKeyMigrated).toBe(false)
  })
})
