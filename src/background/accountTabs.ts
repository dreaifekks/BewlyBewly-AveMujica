import type Browser from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import { DEFAULT_COOKIE_STORE_ID } from './accountCookies'

export async function reloadSiblingBilibiliTabs(
  sender: Browser.Runtime.MessageSender,
  cookieStoreId: string,
  isFirefox: boolean,
  extraExcludedTabIds: number[] = [],
): Promise<void> {
  try {
    const excludedTabIds = new Set(extraExcludedTabIds)
    if (sender.tab?.id !== undefined)
      excludedTabIds.add(sender.tab.id)

    const senderIsIncognito = sender.tab?.incognito ?? false
    const tabs = await browser.tabs.query({ url: '*://*.bilibili.com/*' })
    await Promise.all(tabs.map(async (tab) => {
      if (
        tab.id === undefined
        || tab.discarded
        || excludedTabIds.has(tab.id)
        || (tab.incognito ?? false) !== senderIsIncognito
      ) {
        return
      }
      if (isFirefox && (tab.cookieStoreId || DEFAULT_COOKIE_STORE_ID) !== cookieStoreId)
        return

      await browser.tabs.reload(tab.id).catch(error =>
        console.error('[AccountManager] Failed to reload a sibling Bilibili tab:', error))
    }))
  }
  catch (error) {
    console.error('[AccountManager] Failed to find sibling Bilibili tabs:', error)
  }
}
