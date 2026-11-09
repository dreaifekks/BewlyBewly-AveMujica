import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'
import { openLinkToNewTab } from '~/utils/main'

import type { MomentEntry, MomentOpenTarget } from './types'

/** 动态详情页：图文能放进抽屉，其余的在 t.bilibili.com，只能在新标签页打开 */
export function detailTargetOf(entry: MomentEntry): MomentOpenTarget {
  if (entry.open.kind === 'drawer')
    return entry.open
  return { kind: 'newTab', url: `https://t.bilibili.com/${entry.id}` }
}

/** 评论区：视频动态的评论就是视频的评论，在视频页里看 */
export function commentTargetOf(entry: MomentEntry): MomentOpenTarget {
  return entry.open.kind === 'video' ? entry.open : detailTargetOf(entry)
}

/** 打开卡片、评论区等。视频按「视频卡片链接打开方式」设置，按住 Ctrl 或 ⌘ 时总是新标签页 */
export function useMomentOpener() {
  const { openIframeDrawer } = useBewlyApp()

  return function open(target: MomentOpenTarget, event?: MouseEvent) {
    if (event && (event.ctrlKey || event.metaKey)) {
      openLinkToNewTab(target.url)
      return
    }

    if (target.kind === 'drawer') {
      openIframeDrawer(target.url)
      return
    }

    if (target.kind === 'video') {
      const mode = settings.value.videoCardLinkOpenMode
      if (mode === 'drawer')
        openIframeDrawer(target.url)
      else if (mode === 'currentTab')
        window.open(target.url, '_top')
      else
        openLinkToNewTab(target.url)
      return
    }

    openLinkToNewTab(target.url)
  }
}
