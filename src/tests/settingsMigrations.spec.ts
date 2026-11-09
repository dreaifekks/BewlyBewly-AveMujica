import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('webextension-polyfill', () => {
  const browser = {
    runtime: { id: 'test-extension-id' },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store.get(key) }),
        set: async (items: Record<string, string>) => {
          for (const [k, v] of Object.entries(items))
            store.set(k, v)
        },
        remove: async (key: string) => { store.delete(key) },
      },
      onChanged: { addListener: () => {} },
    },
  }
  return { default: browser, storage: browser.storage }
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function storedDockItems() {
  return JSON.parse(store.get('settings') ?? '{}').dockItemsConfig as { page: string, useOriginalBiliPage: boolean }[]
}

describe('settings migrations', () => {
  beforeEach(() => {
    store.clear()
    vi.resetModules()
  })

  it('turns off the forced original page for moments once', async () => {
    // 旧版没有动态页，Dock 把动态项强制设成了「使用B站原版网页」
    store.set('settings', JSON.stringify({
      dockItemsConfig: [
        { page: 'Home', visible: true, openInNewTab: false, useOriginalBiliPage: false },
        { page: 'Moments', visible: true, openInNewTab: false, useOriginalBiliPage: true },
      ],
    }))

    const { runSettingsMigrations, settingsMigrations } = await import('../logic/migrations')
    const { settings } = await import('../logic/storage')
    await runSettingsMigrations()
    await flush()

    expect(storedDockItems().find(item => item.page === 'Moments')?.useOriginalBiliPage).toBe(false)
    expect(storedDockItems().find(item => item.page === 'Home')?.useOriginalBiliPage).toBe(false)
    expect(JSON.parse(store.get('settingsMigrations')!).momentsBewlyPage).toBe(true)

    // 用户之后自己改回B站原版，不再被改掉
    settings.value.dockItemsConfig.find(item => item.page === 'Moments')!.useOriginalBiliPage = true
    await flush()
    await runSettingsMigrations()
    await flush()
    expect(settingsMigrations.value.momentsBewlyPage).toBe(true)
    expect(storedDockItems().find(item => item.page === 'Moments')?.useOriginalBiliPage).toBe(true)
  })

  it('does not touch a choice made after the migration already ran', async () => {
    store.set('settingsMigrations', JSON.stringify({ momentsBewlyPage: true }))
    store.set('settings', JSON.stringify({
      dockItemsConfig: [{ page: 'Moments', visible: true, openInNewTab: false, useOriginalBiliPage: true }],
    }))

    const { runSettingsMigrations } = await import('../logic/migrations')
    await runSettingsMigrations()
    await flush()

    expect(storedDockItems()[0].useOriginalBiliPage).toBe(true)
  })
})
