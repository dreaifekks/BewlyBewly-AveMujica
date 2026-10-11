import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Browser from 'webextension-polyfill'

import { reloadSiblingBilibiliTabs } from '~/background/accountTabs'

const browserMock = vi.hoisted(() => ({
  query: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: browserMock.query,
      reload: browserMock.reload,
    },
  },
}))

function sender(tab: Partial<Browser.Tabs.Tab>): Browser.Runtime.MessageSender {
  return { tab: tab as Browser.Tabs.Tab }
}

describe('account tab synchronization', () => {
  beforeEach(() => {
    browserMock.query.mockReset()
    browserMock.reload.mockReset()
    browserMock.reload.mockResolvedValue(undefined)
  })

  it('reloads Chromium siblings in the same browsing context', async () => {
    browserMock.query.mockResolvedValue([
      { id: 1, incognito: false },
      { id: 2, incognito: false },
      { id: 3, incognito: true },
      { id: 4, incognito: false, discarded: true },
      { id: 5 },
    ])

    await reloadSiblingBilibiliTabs(
      sender({ id: 1, incognito: false }),
      '0',
      false,
    )

    expect(browserMock.reload).toHaveBeenCalledTimes(2)
    expect(browserMock.reload).toHaveBeenNthCalledWith(1, 2)
    expect(browserMock.reload).toHaveBeenNthCalledWith(2, 5)
  })

  it('only reloads the affected Firefox container', async () => {
    browserMock.query.mockResolvedValue([
      { id: 1, incognito: false, cookieStoreId: 'firefox-container-1' },
      { id: 2, incognito: false, cookieStoreId: 'firefox-container-1' },
      { id: 3, incognito: false, cookieStoreId: 'firefox-container-2' },
      { id: 4, incognito: false, cookieStoreId: 'firefox-container-1' },
    ])

    await reloadSiblingBilibiliTabs(
      sender({ id: 1, incognito: false, cookieStoreId: 'firefox-container-1' }),
      'firefox-container-1',
      true,
      [4],
    )

    expect(browserMock.reload).toHaveBeenCalledOnce()
    expect(browserMock.reload).toHaveBeenCalledWith(2)
  })

  it('does not fail a committed account change when a tab reload fails', async () => {
    browserMock.query.mockResolvedValue([
      { id: 2, incognito: false },
    ])
    browserMock.reload.mockRejectedValue(new Error('Tab closed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(reloadSiblingBilibiliTabs(
      sender({ id: 1, incognito: false }),
      '0',
      false,
    )).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })
})
