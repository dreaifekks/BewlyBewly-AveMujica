import { useStorageLocal } from '~/composables/useStorageLocal'
import { AppPage } from '~/enums/appEnums'

import { settings } from './storage'

/** 做过的一次性设置迁移，每项只做一次，之后用户怎么改都不再动 */
export const settingsMigrations = useStorageLocal('settingsMigrations', ref({
  /**
   * 动态页有了 Bewly 自己的页面。以前没有，Dock 会把动态项强制设成「使用B站原版网页」，
   * 这里关掉一次，用户之后再打开就随他
   */
  momentsBewlyPage: false,
}), { mergeDefaults: true })

/** 把以前被强制打开的「动态 → 使用B站原版网页」关掉，返回这次有没有改 */
export function migrateMomentsDockItem(): boolean {
  if (settingsMigrations.value.momentsBewlyPage)
    return false

  let changed = false
  const moments = settings.value.dockItemsConfig.find(item => item.page === AppPage.Moments)
  if (moments?.useOriginalBiliPage) {
    moments.useOriginalBiliPage = false
    changed = true
  }
  settingsMigrations.value.momentsBewlyPage = true
  return changed
}

/** 等设置读出来再迁移，读出来之前改的值会被存储里的覆盖 */
export async function runSettingsMigrations() {
  await Promise.all([settings.ready, settingsMigrations.ready])
  migrateMomentsDockItem()
}
