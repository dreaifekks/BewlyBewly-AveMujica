import { beforeEach, describe, expect, it, vi } from 'vitest'
import browser from 'webextension-polyfill'

import { getBilibiliUid, replaceBilibiliCookiesWithRollback } from '~/background/accountCookies'
import type { StoredBilibiliCookie } from '~/types/accountManager'

const cookieState = vi.hoisted(() => ({
  cookies: [] as Array<Record<string, unknown>>,
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    cookies: {
      getAll: vi.fn(async (details: { storeId?: string }) =>
        cookieState.cookies.filter(cookie =>
          cookie.storeId === (details.storeId ?? '0'))),
      get: vi.fn(async (details: { name: string, storeId?: string }) =>
        cookieState.cookies.find(cookie =>
          cookie.name === details.name
          && (cookie.storeId === (details.storeId ?? '0'))) ?? null),
      remove: vi.fn(async (details: { name: string, storeId?: string }) => {
        const index = cookieState.cookies.findIndex(cookie =>
          cookie.name === details.name
          && (cookie.storeId === (details.storeId ?? '0')))
        if (index >= 0)
          cookieState.cookies.splice(index, 1)
        return null
      }),
      set: vi.fn(async (details: Record<string, unknown>) => {
        const targetUrl = new URL(String(details.url))
        const domain = details.domain ?? targetUrl.hostname
        const path = details.path ?? '/'
        const storeId = details.storeId ?? '0'
        const index = cookieState.cookies.findIndex(cookie =>
          cookie.name === details.name
          && cookie.domain === domain
          && cookie.path === path
          && cookie.storeId === storeId)
        const cookie = {
          domain,
          expirationDate: details.expirationDate,
          hostOnly: !details.domain,
          httpOnly: details.httpOnly ?? false,
          name: details.name,
          path,
          sameSite: details.sameSite ?? 'lax',
          secure: details.secure ?? true,
          session: details.expirationDate === undefined,
          storeId,
          value: details.value,
        }
        if (index >= 0)
          cookieState.cookies[index] = cookie
        else
          cookieState.cookies.push(cookie)
        return cookie
      }),
    },
  },
}))

function storedUidCookie(uid: string): StoredBilibiliCookie {
  return {
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
  }
}

describe('account Cookie replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieState.cookies = [{
      ...storedUidCookie('100'),
      storeId: '0',
    }]
  })

  it('replaces the active account only after UID verification', async () => {
    await replaceBilibiliCookiesWithRollback([storedUidCookie('200')], '200', '0')

    expect(cookieState.cookies.find(cookie => cookie.name === 'DedeUserID')?.value).toBe('200')
  })

  it('restores the previous Cookie snapshot when verification fails', async () => {
    await expect(
      replaceBilibiliCookiesWithRollback([storedUidCookie('300')], '200', '0'),
    ).rejects.toThrow('Cookie restore verification failed')

    expect(cookieState.cookies.find(cookie => cookie.name === 'DedeUserID')?.value).toBe('100')
  })

  it('restores the previous Cookie snapshot when committing the switch fails', async () => {
    await expect(
      replaceBilibiliCookiesWithRollback(
        [storedUidCookie('200')],
        '200',
        '0',
        async () => {
          throw new Error('Vault write failed')
        },
      ),
    ).rejects.toThrow('Vault write failed')

    expect(cookieState.cookies.find(cookie => cookie.name === 'DedeUserID')?.value).toBe('100')
  })

  it('does not modify a different Firefox Cookie store', async () => {
    cookieState.cookies.push({
      ...storedUidCookie('900'),
      storeId: 'firefox-container-9',
    })

    await replaceBilibiliCookiesWithRollback([storedUidCookie('200')], '200', '0')

    expect(cookieState.cookies.find(cookie => cookie.storeId === '0')?.value).toBe('200')
    expect(cookieState.cookies.find(cookie => cookie.storeId === 'firefox-container-9')?.value).toBe('900')
  })

  it('never passes the placeholder store ID to the cookies API', async () => {
    // Safari rejects any storeId outside its own "persistent-N" / "ephemeral-N" identifiers.
    await replaceBilibiliCookiesWithRollback([storedUidCookie('200')], '200', '0')

    for (const method of ['get', 'getAll', 'remove', 'set'] as const) {
      const calls = vi.mocked(browser.cookies[method]).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      for (const [details] of calls)
        expect(details).not.toHaveProperty('storeId')
    }
  })

  it('still targets an explicit Cookie store', async () => {
    cookieState.cookies.push({
      ...storedUidCookie('900'),
      storeId: 'firefox-container-9',
    })

    expect(await getBilibiliUid('firefox-container-9')).toBe('900')
    expect(vi.mocked(browser.cookies.get).mock.calls[0][0]).toMatchObject({ storeId: 'firefox-container-9' })
  })
})
