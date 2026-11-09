import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('webextension-polyfill', () => {
  const browser = {
    runtime: { id: 'test-extension-id' },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
      onChanged: { addListener: () => {} },
    },
  }
  return { default: browser, storage: browser.storage }
})

const { settings } = await import('../logic/storage')
const { useSettingsStore } = await import('../stores/settingsStore')
const { AppPage } = await import('../enums/appEnums')

function setMomentsUseOriginalPage(useOriginalBiliPage: boolean) {
  settings.value.dockItemsConfig = [
    { page: AppPage.Home, visible: true, openInNewTab: false, useOriginalBiliPage: false },
    { page: AppPage.Moments, visible: true, openInNewTab: false, useOriginalBiliPage },
  ]
}

describe('momentsPageUrl', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    settings.value.useOriginalBilibiliHomepage = false
  })

  it('points the moments entries at the Bewly moments page', () => {
    setMomentsUseOriginalPage(false)
    expect(useSettingsStore().momentsPageUrl).toBe('https://www.bilibili.com/?page=Moments')
  })

  it('keeps the bilibili moments page when the user chose the original page', () => {
    setMomentsUseOriginalPage(true)
    expect(useSettingsStore().momentsPageUrl).toBe('https://t.bilibili.com/')
  })

  it('keeps the bilibili moments page when the Bewly homepage is turned off', () => {
    setMomentsUseOriginalPage(false)
    settings.value.useOriginalBilibiliHomepage = true
    expect(useSettingsStore().momentsPageUrl).toBe('https://t.bilibili.com/')
  })
})
