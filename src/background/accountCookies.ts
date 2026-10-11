import type Browser from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import type { StoredBilibiliCookie } from '~/types/accountManager'

export const BILIBILI_HOME_URL = 'https://www.bilibili.com/'
export const DEFAULT_COOKIE_STORE_ID = '0'

export function getSenderCookieStoreId(sender: Browser.Runtime.MessageSender): string {
  return sender.tab?.cookieStoreId || DEFAULT_COOKIE_STORE_ID
}

// Only Firefox exposes tab.cookieStoreId. Elsewhere DEFAULT_COOKIE_STORE_ID is just a vault key:
// Safari names its stores "persistent-N" / "ephemeral-N" and throws on any other storeId, so the
// placeholder must not reach the cookies API. Omitting storeId selects the extension's own store.
function storeDetails(cookieStoreId: string): { storeId?: string } {
  return cookieStoreId === DEFAULT_COOKIE_STORE_ID ? {} : { storeId: cookieStoreId }
}

export function storedCookieUrl(cookie: Pick<StoredBilibiliCookie, 'domain' | 'path' | 'secure'>): string {
  const hostname = cookie.domain.replace(/^\./, '')
  const path = cookie.path.startsWith('/') ? cookie.path : '/'.concat(cookie.path)
  return (cookie.secure ? 'https://' : 'http://').concat(hostname, path)
}

export function serializeCookie(cookie: Browser.Cookies.Cookie): StoredBilibiliCookie {
  const firefoxCookie = cookie as Browser.Cookies.Cookie & { firstPartyDomain?: string }
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    hostOnly: cookie.hostOnly,
    session: cookie.session,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
    firstPartyDomain: firefoxCookie.firstPartyDomain,
  }
}

export async function captureBilibiliCookies(cookieStoreId: string): Promise<StoredBilibiliCookie[]> {
  const cookies = await browser.cookies.getAll({
    domain: 'bilibili.com',
    ...storeDetails(cookieStoreId),
  })
  return cookies.map(serializeCookie)
}

export async function getBilibiliUid(cookieStoreId: string): Promise<string | null> {
  const cookie = await browser.cookies.get({
    url: BILIBILI_HOME_URL,
    name: 'DedeUserID',
    ...storeDetails(cookieStoreId),
  })
  return cookie?.value || null
}

export async function clearBilibiliCookies(cookieStoreId: string): Promise<void> {
  const cookies = await captureBilibiliCookies(cookieStoreId)
  await Promise.all(cookies.map(cookie => browser.cookies.remove({
    url: storedCookieUrl(cookie),
    name: cookie.name,
    ...storeDetails(cookieStoreId),
  })))
}

export async function restoreBilibiliCookies(
  cookies: StoredBilibiliCookie[],
  cookieStoreId: string,
): Promise<void> {
  await clearBilibiliCookies(cookieStoreId)

  for (const cookie of cookies) {
    const details: Browser.Cookies.SetDetailsType & { firstPartyDomain?: string } = {
      url: storedCookieUrl(cookie),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite as Browser.Cookies.SameSiteStatus | undefined,
      ...storeDetails(cookieStoreId),
    }

    if (!cookie.hostOnly)
      details.domain = cookie.domain
    if (!cookie.session && cookie.expirationDate)
      details.expirationDate = cookie.expirationDate
    if (cookie.firstPartyDomain)
      details.firstPartyDomain = cookie.firstPartyDomain

    await browser.cookies.set(details)
  }
}

export async function replaceBilibiliCookiesWithRollback(
  cookies: StoredBilibiliCookie[],
  expectedUid: string,
  cookieStoreId: string,
  commit?: () => Promise<void>,
): Promise<void> {
  const previousCookies = await captureBilibiliCookies(cookieStoreId)
  try {
    await restoreBilibiliCookies(cookies, cookieStoreId)
    const restoredUid = await getBilibiliUid(cookieStoreId)
    if (restoredUid !== expectedUid)
      throw new Error('Cookie restore verification failed for UID '.concat(expectedUid))
    await commit?.()
  }
  catch (error) {
    await restoreBilibiliCookies(previousCookies, cookieStoreId)
    throw error
  }
}
