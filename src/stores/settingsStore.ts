import { defineStore } from 'pinia'

import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'

export interface DockItemConfig {
  page: AppPage
  visible: boolean
  openInNewTab: boolean
  useOriginalBiliPage: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  function getDockItemConfigByPage(page: AppPage): DockItemConfig | undefined {
    return settings.value.dockItemsConfig.find(e => e.page === page)
  }

  function getDockItemIsUseOriginalBiliPage(page: AppPage): boolean {
    return settings.value.dockItemsConfig.find(e => e.page === page)?.useOriginalBiliPage || false
  }

  /** 顶栏等处的「动态」入口：用着 Bewly 的动态页时指向它，否则指向B站的动态页 */
  const momentsPageUrl = computed((): string => {
    if (settings.value.useOriginalBilibiliHomepage || getDockItemIsUseOriginalBiliPage(AppPage.Moments))
      return 'https://t.bilibili.com/'
    return `https://www.bilibili.com/?page=${AppPage.Moments}`
  })

  return { getDockItemConfigByPage, getDockItemIsUseOriginalBiliPage, momentsPageUrl }
})
