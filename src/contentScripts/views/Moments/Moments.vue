<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn, useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useBewlyApp } from '~/composables/useAppProvider'
import type { InfiniteLoadResult } from '~/composables/useInfiniteList'
import { useInfiniteList } from '~/composables/useInfiniteList'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { gridLayout, settings } from '~/logic'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import type { FeedResult, PortalLiveUser, PortalResult } from '~/models/moment/momentFeed'
import api from '~/utils/api'
import { getUserID } from '~/utils/main'
import emitter from '~/utils/mitt'

import MomentAvatar from './components/MomentAvatar.vue'
import MomentCard from './components/MomentCard.vue'
import MomentsImageViewer from './components/MomentsImageViewer.vue'
import MomentsUpStrip from './components/MomentsUpStrip.vue'
import { feedTypeOf, matchesTab, maxColumnsFit, normalizeLiveUsers, normalizeMoments, normalizeUps, shortestColumn } from './momentsData'
import type { MomentEntry, MomentImage, MomentsLiveUser, MomentsTab, MomentsUp } from './types'
import { MOMENTS_TABS } from './types'

const { t } = useI18n()
const { handleBackToTop, handlePageRefresh } = useBewlyApp()

/** 列数切换器可选的列数 */
const COLUMN_OPTIONS = [2, 3, 4]
/** 隔多久看一次有没有新动态 */
const NEW_MOMENTS_CHECK_INTERVAL = 60_000

const activeTab = ref<MomentsTab>('all')
const selectedUp = ref<{ mid: string, name: string, face: string } | null>(null)
const selectedMid = computed(() => selectedUp.value?.mid ?? null)

/* ---------- 头像栏 ---------- */
const ups = ref<MomentsUp[]>([])
const liveUsers = ref<MomentsLiveUser[]>([])
const myMid = ref<string>(getUserID())
const liveMids = computed(() => new Set(liveUsers.value.map(u => u.mid)))
const followingUrl = computed(() => `https://space.bilibili.com/${myMid.value}/fans/follow`)
const needToLoginFirst = ref(false)

/** 直播的关注列表按「正在直播」排在前面，翻到不在直播的就停 */
async function getFollowingLive(): Promise<FollowingLiveItem[]> {
  const list: FollowingLiveItem[] = []
  for (let page = 1; page <= 10; page++) {
    const res: FollowingLiveResult = await api.live.getFollowingLiveList({ page, page_size: 9 })
    if (res.code !== 0)
      throw new Error(`getFollowingLiveList failed with code ${res.code}`)
    const items = res.data?.list ?? []
    list.push(...items)
    if (items.length < 9 || items.at(-1)?.live_status !== 1)
      break
  }
  return list
}

let stripVersion = 0
async function loadStrip() {
  const version = ++stripVersion
  const [portal, followingLive] = await Promise.allSettled([
    api.moment.getMomentsPortal() as Promise<PortalResult>,
    getFollowingLive(),
  ])
  if (version !== stripVersion)
    return

  let portalLive: PortalLiveUser[] = []
  if (portal.status === 'fulfilled') {
    const res = portal.value
    if (res.code === -101) {
      needToLoginFirst.value = true
      return
    }
    if (res.code === 0 && res.data) {
      ups.value = normalizeUps(res.data.up_list?.items)
      portalLive = res.data.live_users?.items ?? []
      if (res.data.my_info?.mid)
        myMid.value = String(res.data.my_info.mid)
    }
  }
  else {
    console.error('[BewlyBewly] Failed to load the moments portal:', portal.reason)
  }

  if (followingLive.status === 'rejected')
    console.error('[BewlyBewly] Failed to load the following live list:', followingLive.reason)
  liveUsers.value = normalizeLiveUsers(followingLive.status === 'fulfilled' ? followingLive.value : null, portalLive)
}

/* ---------- 瀑布流 ---------- */
const board = useTemplateRef<HTMLElement>('board')
const boardWidth = ref(0)
useResizeObserver(board, (entries) => {
  boardWidth.value = entries[0].contentRect.width
})

const maxColumns = computed(() => maxColumnsFit(boardWidth.value))
const columnCount = computed(() => Math.min(gridLayout.value.moments || 3, maxColumns.value))
const columns = ref<MomentEntry[][]>([])

/** 已加载、属于当前筛选的动态，按到达顺序 */
let loadedEntries: MomentEntry[] = []
const seenIds = new Set<string>()
const entryCount = ref(0)
let offset = ''
let page = 1
let updateBaseline = ''
const noMoreContent = ref(false)
/** 连续几页挑不出属于当前筛选的动态 */
let emptyPages = 0
/** 挑了这么多页还一条都没有，就当作没有 */
const MAX_EMPTY_PAGES = 8
/** 点了提示才刷新的新动态条数 */
const newMomentsCount = ref(0)
/** 换筛选、刷新时加一，丢掉旧请求的结果 */
let feedVersion = 0
/** 重新排版时加一，停掉正在进行的摆放 */
let layoutVersion = 0

function emptyColumns(count: number): MomentEntry[][] {
  return Array.from({ length: count }, () => [])
}

/** 一张一张放进最矮的一列，放好就不再挪；每放一张等它渲染出来再量下一列的高度 */
async function placeEntries(entries: MomentEntry[], version: number) {
  for (const entry of entries) {
    if (version !== layoutVersion)
      return
    const cols = columns.value
    const els = board.value ? Array.from(board.value.children) as HTMLElement[] : []
    const heights = els.length === cols.length
      ? els.map(el => el.getBoundingClientRect().height)
      : cols.map(col => col.length)
    cols[shortestColumn(heights)].push(markRaw(entry))
    await nextTick()
  }
}

async function relayout() {
  const version = ++layoutVersion
  columns.value = emptyColumns(columnCount.value)
  await nextTick()
  await placeEntries(loadedEntries, version)
}

onMounted(() => {
  // 先量出宽度再开始加载，免得先按一列排、量完又重排
  boardWidth.value = board.value?.clientWidth ?? 0
  columns.value = emptyColumns(columnCount.value)
})

watch(columnCount, (count, oldCount) => {
  if (count !== oldCount && columns.value.length)
    relayout()
})

async function loadFeed(signal: AbortSignal): Promise<InfiniteLoadResult> {
  const version = feedVersion
  const tab = activeTab.value
  const hostMid = selectedMid.value ?? undefined

  const res: FeedResult = await api.moment.getMomentsFeed({
    type: feedTypeOf(tab, hostMid),
    offset,
    page,
    host_mid: hostMid,
  })
  if (signal.aborted || version !== feedVersion)
    return 'more'

  if (res.code === -101) {
    needToLoginFirst.value = true
    return 'done'
  }
  // 没有可显示的动态时接口返回 4101132
  if (res.code === 4101132) {
    noMoreContent.value = true
    return 'done'
  }
  if (res.code !== 0 || !res.data)
    throw new Error(`getMomentsFeed failed with code ${res.code}: ${res.message}`)

  const data = res.data
  if (page === 1)
    updateBaseline = data.update_baseline
  offset = data.offset
  page++

  const entries = normalizeMoments(data.items, seenIds).filter(entry => matchesTab(entry, tab))
  loadedEntries.push(...entries)
  entryCount.value = loadedEntries.length
  emptyPages = entries.length ? 0 : emptyPages + 1
  await placeEntries(entries, layoutVersion)

  // 「动态」和只看某个 UP 主时是从「全部」里挑的，翻了很多页还一条都没有就显示空状态，不再一直翻
  if (!data.has_more || !data.offset || (!loadedEntries.length && emptyPages >= MAX_EMPTY_PAGES)) {
    noMoreContent.value = true
    return 'done'
  }
  return entries.length ? 'more' : 'empty'
}

const sentinel = useTemplateRef<HTMLElement>('sentinel')
const { loading, error: loadError, restart } = useInfiniteList({
  sentinel,
  rootMargin: '0px 0px 800px 0px',
  canLoadMore: () => !needToLoginFirst.value && columns.value.length > 0,
  load: loadFeed,
  // 「动态」和只看某个 UP 主时是从「全部」里挑的，一页可能一条也不剩
  maxEmptyLoads: MAX_EMPTY_PAGES,
})

function resetFeed() {
  feedVersion++
  layoutVersion++
  loadedEntries = []
  seenIds.clear()
  entryCount.value = 0
  offset = ''
  page = 1
  emptyPages = 0
  updateBaseline = ''
  noMoreContent.value = false
  newMomentsCount.value = 0
  columns.value = emptyColumns(columnCount.value)
  restart()
}

/* ---------- 筛选 ---------- */
function scrollToTop() {
  if (document.documentElement.scrollTop > 0)
    handleBackToTop()
}

function changeTab(tab: MomentsTab) {
  if (activeTab.value === tab) {
    scrollToTop()
    return
  }
  activeTab.value = tab
  scrollToTop()
  resetFeed()
}

/** 只看某个 UP 主；再点一次已选中的就取消 */
function selectUp(mid: string | null, toggle = true) {
  const next = mid && !(toggle && mid === selectedMid.value) ? mid : null
  if (next === selectedMid.value)
    return

  if (next) {
    const up = ups.value.find(u => u.mid === next) ?? liveUsers.value.find(u => u.mid === next)
    selectedUp.value = { mid: next, name: up?.name ?? '', face: up?.face ?? '' }
    // 看过了，去掉「有新动态」的点
    ups.value = ups.value.map(u => u.mid === next ? { ...u, hasUpdate: false } : u)
  }
  else {
    selectedUp.value = null
  }
  scrollToTop()
  resetFeed()
}

/* ---------- 新动态 ---------- */
const freshIds = ref<Set<string>>(new Set())
const documentVisibility = useDocumentVisibility()

async function checkNewMoments() {
  if (documentVisibility.value !== 'visible' || !updateBaseline || selectedMid.value || needToLoginFirst.value)
    return
  const version = feedVersion
  try {
    const res = await api.moment.getTopBarNewMomentsCount({
      type: feedTypeOf(activeTab.value),
      update_baseline: updateBaseline,
    })
    if (version === feedVersion && res.code === 0)
      newMomentsCount.value = Number(res.data?.update_num) || 0
  }
  catch (error) {
    console.error('[BewlyBewly] Failed to check new moments:', error)
  }
}

useIntervalFn(checkNewMoments, NEW_MOMENTS_CHECK_INTERVAL)
watch(documentVisibility, (visibility) => {
  if (visibility === 'visible')
    checkNewMoments()
})

// 新动态不自动插进瀑布流，点了提示才刷新；刷出来的新卡片闪一下
let freshTimer: ReturnType<typeof setTimeout> | undefined
/** 在事件里建的侦听器不跟着组件停，要自己停 */
let stopFreshWatch: (() => void) | undefined
function showNewMoments() {
  const previousIds = new Set(loadedEntries.map(entry => entry.id))
  scrollToTop()
  refreshAll()
  const version = feedVersion
  stopFreshWatch?.()
  const stop = watch(entryCount, (count) => {
    // 刷新完之前又换了筛选，就不标了
    if (version !== feedVersion) {
      stop()
      return
    }
    if (!count)
      return
    stop()
    freshIds.value = new Set(loadedEntries.filter(entry => !previousIds.has(entry.id)).map(entry => entry.id))
    clearTimeout(freshTimer)
    freshTimer = setTimeout(() => {
      freshIds.value = new Set()
    }, 3000)
  })
  stopFreshWatch = stop
}

function refreshAll() {
  loadStrip()
  resetFeed()
}

/* ---------- 看大图 ---------- */
const viewer = ref<{ images: MomentImage[], index: number } | null>(null)

function openViewer(images: MomentImage[], index: number) {
  viewer.value = { images, index }
}

/* ---------- 顶栏自动隐藏时，标签栏跟着上移 ---------- */
const shouldMoveTabsUp = ref(false)
function handleTopBarVisibilityChange(visible: boolean) {
  shouldMoveTabsUp.value = settings.value.autoHideTopBar && settings.value.showTopBar && !visible
}

onMounted(() => {
  emitter.on(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibilityChange)
  handlePageRefresh.value = refreshAll
  loadStrip()
})

onUnmounted(() => {
  emitter.off(TOP_BAR_VISIBILITY_CHANGE, handleTopBarVisibilityChange)
  clearTimeout(freshTimer)
  stopFreshWatch?.()
})

const emptyDescription = computed(() => {
  const type = t(`moments.nouns.${activeTab.value}`)
  return selectedUp.value?.name
    ? t('moments.empty_of_up', { name: selectedUp.value.name, type })
    : t('moments.empty', { type })
})

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}
</script>

<template>
  <div class="moments-page">
    <Empty v-if="needToLoginFirst" mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>

    <template v-else>
      <!-- 吸顶的标签栏，和首页的标签栏、布局切换器同一套样式 -->
      <header class="moments-header" :class="{ hide: shouldMoveTabsUp }">
        <nav class="glass-pill">
          <button
            v-for="item in MOMENTS_TABS" :key="item.tab"
            class="tab" :class="{ active: activeTab === item.tab }"
            :title="item.descI18nKey ? $t(item.descI18nKey) : undefined"
            @click="changeTab(item.tab)"
          >
            {{ $t(item.i18nKey) }}
          </button>
        </nav>

        <Transition name="up-chip">
          <div v-if="selectedUp" class="glass-pill up-chip">
            <MomentAvatar v-if="selectedUp.face" :face="selectedUp.face" :size="28" />
            <span class="up-chip-text">{{ $t('moments.only_show') }} <b>{{ selectedUp.name }}</b></span>
            <button class="up-chip-close" :title="$t('moments.all_moments')" @click="selectUp(null)">
              <i i-mingcute:close-line />
            </button>
          </div>
        </Transition>

        <div v-if="settings.enableGridLayoutSwitcher" class="glass-pill columns-switcher">
          <button
            v-for="count in COLUMN_OPTIONS" :key="count"
            class="column-btn" :class="{ active: columnCount === count }"
            :disabled="count > maxColumns"
            :title="count > maxColumns ? $t('moments.window_too_narrow') : $t('moments.columns', { count })"
            @click="gridLayout.moments = count"
          >
            <svg
              viewBox="0 0 20 16" width="1em" height="1em" fill="none" stroke="currentColor"
              stroke-width="1.7"
            >
              <rect x="1.2" y="1.2" width="17.6" height="13.6" rx="3.2" />
              <line
                v-for="line in count - 1" :key="line"
                :x1="1.2 + 17.6 * line / count" y1="1.6"
                :x2="1.2 + 17.6 * line / count" y2="14.4"
              />
            </svg>
          </button>
        </div>
      </header>

      <MomentsUpStrip
        :ups="ups"
        :live-users="liveUsers"
        :selected-mid="selectedMid"
        :following-url="followingUrl"
        @select="(mid) => selectUp(mid, !liveMids.has(mid ?? ''))"
      />

      <!-- 新动态提示贴着瀑布流的上沿，上沿滚过标签栏之后就停在标签栏下面 -->
      <div class="new-moments-anchor">
        <Transition name="new-moments">
          <button v-if="newMomentsCount > 0 && !selectedMid" class="new-moments" @click="showNewMoments">
            <i i-mingcute:arrow-up-line />
            {{ $t('moments.new_moments', { count: newMomentsCount }) }}
          </button>
        </Transition>
      </div>

      <div ref="board" class="moments-board">
        <div v-for="(column, columnIndex) in columns" :key="columnIndex" class="moments-column">
          <MomentCard
            v-for="entry in column" :key="entry.id"
            :entry="entry"
            :author-live="liveMids.has(entry.author.mid)"
            :fresh="freshIds.has(entry.id)"
            @view-images="openViewer"
          />
          <div v-if="loading" class="skeleton-card" aria-hidden="true">
            <div class="skeleton-head">
              <span class="skeleton avatar" />
              <div flex-1>
                <span class="skeleton" w="42%" h-12px />
                <span class="skeleton" w="24%" h-10px mt-7px />
              </div>
            </div>
            <span class="skeleton" w-full aspect-video rounded-10px />
            <span class="skeleton" w="86%" h-12px mt-12px />
            <span class="skeleton" w="58%" h-12px mt-8px mb-12px />
          </div>
        </div>
      </div>

      <div ref="sentinel" aria-hidden="true" h-1px />

      <div v-if="!loading" class="moments-status">
        <Empty v-if="!entryCount && (noMoreContent || loadError)" mt-6 :description="loadError ? $t('moments.load_failed') : emptyDescription">
          <Button v-if="loadError" type="primary" @click="restart()">
            {{ $t('moments.retry') }}
          </Button>
        </Empty>
        <template v-else-if="noMoreContent">
          {{ $t('common.no_more_content') }}
        </template>
        <button v-else-if="loadError" class="retry" @click="restart()">
          {{ $t('moments.load_failed') }} · {{ $t('moments.retry') }}
        </button>
      </div>
    </template>

    <MomentsImageViewer
      v-if="viewer"
      :images="viewer.images"
      :start-index="viewer.index"
      @close="viewer = null"
    />
  </div>
</template>

<style scoped lang="scss">
.moments-page {
  padding-bottom: 96px;
}

.moments-header {
  position: sticky;
  top: calc(var(--bew-top-bar-height) + 10px);
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  transition: transform 0.3s ease-in-out;

  &.hide {
    transform: translateY(-70px);
  }
}

.glass-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated);
  backdrop-filter: var(--bew-filter-glass-1);
  box-shadow: var(--bew-shadow-1), var(--bew-shadow-edge-glow-1);
  box-sizing: border-box;
}

.tab {
  height: 100%;
  padding: 0 14px;
  border-radius: 999px;
  color: var(--bew-text-2);
  font-size: 14px;
  font-weight: 700;
  transition:
    background 0.3s,
    color 0.3s;

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &.active {
    background: var(--bew-theme-color-auto);
    color: var(--bew-text-auto);
  }
}

.up-chip {
  gap: 8px;
  color: var(--bew-text-2);
  font-size: 13.5px;

  b {
    color: var(--bew-text-1);
  }
}

.up-chip-text {
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-chip-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--bew-text-2);
  font-size: 16px;

  &:hover {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }
}

.up-chip-enter-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}

.up-chip-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.columns-switcher {
  margin-left: auto;
}

.column-btn {
  display: grid;
  place-items: center;
  height: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  color: var(--bew-text-2);
  font-size: 18px;
  transition:
    background 0.3s,
    color 0.3s;

  &:hover:not(:disabled) {
    background: var(--bew-fill-2);
    color: var(--bew-text-1);
  }

  &.active {
    background: var(--bew-theme-color-auto);
    color: var(--bew-text-auto);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.new-moments-anchor {
  position: sticky;
  top: calc(var(--bew-top-bar-height) + 10px + 38px + 14px + 18px);
  z-index: 10;
  height: 0;
}

.new-moments {
  position: absolute;
  top: -18px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 6px 20px var(--bew-theme-color-40);
  transform: translateX(-50%);

  &:hover {
    filter: brightness(1.08);
  }
}

.new-moments-enter-active,
.new-moments-leave-active {
  transition:
    opacity 0.3s,
    transform 0.35s cubic-bezier(0.34, 1.6, 0.6, 1);
}

.new-moments-enter-from,
.new-moments-leave-to {
  opacity: 0;
  transform: translate(-50%, -14px);
}

.moments-board {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.moments-column {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.skeleton-card {
  padding: 14px 16px 6px;
  border-radius: var(--bew-radius);
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated);
  box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);
}

.skeleton-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.skeleton {
  display: block;
  border-radius: 6px;
  background: var(--bew-skeleton);
  animation: moments-skeleton-pulse 1.3s ease-in-out infinite;

  &.avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
  }
}

@keyframes moments-skeleton-pulse {
  50% {
    opacity: 0.5;
  }
}

.moments-status {
  padding: 28px 0 8px;
  color: var(--bew-text-3);
  font-size: 13px;
  text-align: center;
}

.retry {
  color: var(--bew-theme-color);

  &:hover {
    text-decoration: underline;
  }
}
</style>
