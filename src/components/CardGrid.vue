<script setup lang="ts">
import { useEventListener, useResizeObserver } from '@vueuse/core'

import type { GridLayoutType } from '~/logic'
import { fitCardRows } from '~/utils/cardGridFit'
import { createWheelAxisLock } from '~/utils/wheelAxisLock'

const props = withDefaults(defineProps<{
  layout: GridLayoutType
  /** 自适应布局下每行的列数 */
  adaptiveCols?: 'default' | 'wide' | 'bangumi'
}>(), {
  adaptiveCols: 'default',
})

const ROW_GAP = 4
const COLUMN_GAP = 16
// 卡片悬停时有 8px 的 ring，四周留出余量以免被滚动容器裁掉
const PADDING = 10
// 和两列布局一致：容器够宽时一屏两列，窄了就一列
const TWO_COLUMNS_MIN_WIDTH = 1100

const isHorizontalScroll = computed(() => props.layout === 'horizontalScroll')

const gridClass = computed((): string => {
  if (props.layout === 'twoColumns')
    return 'grid-two-columns'
  if (props.layout === 'oneColumn')
    return 'grid-one-column'
  if (props.adaptiveCols === 'wide')
    return 'grid-adaptive-wide'
  if (props.adaptiveCols === 'bangumi')
    return 'grid-adaptive-bangumi'
  return 'grid-adaptive'
})

const scroller = useTemplateRef<HTMLElement>('scroller')
const grid = useTemplateRef<HTMLElement>('grid')
const rows = ref<number>(1)
const columnWidth = ref<number>(0)
/** 卡片的缩放比例，用 CSS zoom 缩放，排版跟着变 */
const cardScale = ref<number>(1)
const firstItem = shallowRef<HTMLElement | null>(null)

/** 卡片不缩放时的高度。量到真实卡片之前先用横版视频卡的大致高度 */
let naturalItemHeight = 176
let needsMeasure = true
let measuredWidth = 0

/**
 * 在缩放为 1 的状态下量可见的真实卡片，同一帧内改回去，不会闪。
 * 卡片开了 content-visibility，新卡片渲染前量到的是占位高度，所以测量时让它们临时正常渲染。
 * 取中位数：个别信息多的卡片不该把所有行都撑开，它们多出的部分落在卡片下方的间距里。
 * 这里不能根据缩放后的尺寸反推，也不能因为缩放引起的尺寸变化重新测量，否则会形成反馈循环，卡片不停抖动。
 */
function measureNaturalHeight(scrollerEl: HTMLElement, gridEl: HTMLElement): number {
  const box = scrollerEl.getBoundingClientRect()
  gridEl.style.setProperty('--card-scale', '1')
  // 列宽可能刚算出来，Vue 还没更新到 DOM，先写上，否则卡片被挤窄，量出来偏高
  gridEl.style.gridAutoColumns = `${columnWidth.value}px`

  // 还全是骨架屏时先量骨架屏，这样卡片加载出来时布局基本不跳；量到真实卡片才算量完
  const visible: Element[] = []
  let hasRealCard = false
  for (const item of gridEl.children) {
    const rect = item.getBoundingClientRect()
    if (rect.left >= box.right)
      break
    if (rect.right > box.left) {
      visible.push(item)
      hasRealCard ||= !!item.querySelector('a')
    }
  }
  visible.forEach(item => item.setAttribute('data-measuring', ''))
  const heights = visible
    .map(item => item.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(item).marginBottom) || 0))
    .sort((a, b) => a - b)
  visible.forEach(item => item.removeAttribute('data-measuring'))

  gridEl.style.setProperty('--card-scale', String(cardScale.value))
  if (hasRealCard)
    needsMeasure = false
  return heights[Math.floor(heights.length / 2)] ?? 0
}

/** 列宽取容器宽度的一半（窄屏取整宽），看起来和两列布局一样；行数和缩放按容器高度和卡片原始高度算 */
function updateLayout() {
  const scrollerEl = scroller.value
  const gridEl = grid.value
  if (!scrollerEl || !gridEl)
    return

  const containerWidth = scrollerEl.clientWidth - PADDING * 2
  if (containerWidth <= 0)
    return
  const visibleColumns = containerWidth >= TWO_COLUMNS_MIN_WIDTH ? 2 : 1
  columnWidth.value = Math.floor((containerWidth - (visibleColumns - 1) * COLUMN_GAP) / visibleColumns)

  // 窗口变宽变窄时封面尺寸可能跟着断点变，卡片高度要重新量
  if (containerWidth !== measuredWidth) {
    measuredWidth = containerWidth
    needsMeasure = true
  }
  if (gridEl.firstElementChild !== firstItem.value) {
    firstItem.value = gridEl.firstElementChild as HTMLElement | null
    needsMeasure = true
  }
  if (needsMeasure) {
    naturalItemHeight = measureNaturalHeight(scrollerEl, gridEl) || naturalItemHeight
  }

  const fit = fitCardRows(scrollerEl.clientHeight - PADDING * 2, naturalItemHeight, ROW_GAP)
  rows.value = fit.rows
  cardScale.value = fit.scale
}

useResizeObserver(scroller, updateLayout)
// 第一张卡片从骨架屏变成真实卡片、或从占位变成已渲染时，还没量到的话再量一次。量到之后这里什么也不做
useResizeObserver(firstItem, () => {
  if (needsMeasure)
    updateLayout()
})
// 列表整个换掉时（刷新、切排行榜分区）第一张卡片会变，要重新量。缩放引起的重新渲染不会让第一张卡片变，也就不会重新测量
onUpdated(() => {
  if (grid.value && (needsMeasure || grid.value.firstElementChild !== firstItem.value))
    updateLayout()
})
onActivated(updateLayout)

/** 鼠标下方的元素自己还能沿这个方向滚，例如顶栏的下拉面板、排行榜的分区列表、首页的标签栏 */
function canScroll(el: Element, axis: 'x' | 'y', delta: number): boolean {
  const [scrollSize, clientSize, position, overflow] = axis === 'y'
    ? [el.scrollHeight, el.clientHeight, el.scrollTop, getComputedStyle(el).overflowY]
    : [el.scrollWidth, el.clientWidth, el.scrollLeft, getComputedStyle(el).overflowX]
  if (scrollSize <= clientSize + 1 || !/auto|scroll|overlay/.test(overflow))
    return false
  return delta < 0 ? position > 0 : position + clientSize < scrollSize - 1
}

/**
 * 页面里只有这一块需要滚动，所以窗口里任何位置的滚轮和触控板滑动都交给它，
 * 和竖着浏览时在哪儿滚都能翻页的手感一致：
 * - 竖向滚动转成横向滚动
 * - 横向滑动在列表外面时也转给列表，列表里面的由浏览器自己处理
 * 一次手势只按一个方向处理，见 createWheelAxisLock。横滑时浏览器原生滚动一旦开始就拦不住了，
 * 这时脚本再改位置会和它叠加，造成惯性末段停滞后又突然移动，所以列表内的横滑全程不插手。
 * 以下情况仍交给页面或别的元素：
 * - 鼠标下方有能沿这个方向滚的元素
 * - 竖向滚动时容器没有完整露出来（例如首页开了搜索页模式，上面还有搜索栏），先让页面竖着滚到位
 * - 已经滚到头
 * 组件被 KeepAlive 缓存时容器离开文档，isConnected 为 false，不再接管滚轮。
 */
const getWheelAxis = createWheelAxisLock()
useEventListener(window, 'wheel', (event: WheelEvent) => {
  const el = scroller.value
  if (!el?.isConnected || event.defaultPrevented || event.ctrlKey)
    return

  const axis = getWheelAxis(event.deltaX, event.deltaY, event.timeStamp)
  const path = event.composedPath()
  if (axis === 'x' && path.includes(el))
    return

  const rawDelta = axis === 'x' ? event.deltaX : event.deltaY
  for (const node of path) {
    if (node === el || node === document.documentElement || node === document.body)
      break
    if (node instanceof Element && canScroll(node, axis, rawDelta))
      return
  }

  const rect = el.getBoundingClientRect()
  if (!rect.width)
    return
  if (axis === 'y' && (rect.top < -1 || rect.bottom > window.innerHeight + 1))
    return

  const maxScrollLeft = el.scrollWidth - el.clientWidth
  if (maxScrollLeft <= 0)
    return
  if (rawDelta < 0 && el.scrollLeft <= 0)
    return
  if (rawDelta > 0 && el.scrollLeft >= maxScrollLeft - 1)
    return

  if (event.cancelable)
    event.preventDefault()
  // Firefox 的鼠标滚轮按行计数
  el.scrollLeft += event.deltaMode === WheelEvent.DOM_DELTA_LINE ? rawDelta * 40 : rawDelta
}, { passive: false })

const horizontalGridStyle = computed(() => ({
  gridTemplateRows: `repeat(${rows.value}, minmax(0, 1fr))`,
  gridAutoColumns: columnWidth.value ? `${columnWidth.value}px` : '50%',
  rowGap: `${ROW_GAP}px`,
  columnGap: `${COLUMN_GAP}px`,
  '--card-scale': cardScale.value,
}))
</script>

<template>
  <!-- 横向滚动：横版卡片按列从上往下排，排满一列换到右边；无限加载的哨兵放在最右端，以这个容器为观察范围 -->
  <div
    v-if="isHorizontalScroll"
    ref="scroller"
    data-horizontal-scroll-grid
    data-infinite-scroll-root
    data-infinite-root-margin="0px 900px 0px 0px"
    class="horizontal-scroller"
    :style="{ padding: `${PADDING}px`, margin: `-${PADDING}px` }"
  >
    <div flex="~" h-full w-max>
      <div ref="grid" class="grid-horizontal-scroll" :style="horizontalGridStyle">
        <slot />
      </div>
      <div flex="~ col justify-center items-center" shrink-0 px-6 whitespace-nowrap>
        <slot name="end" />
      </div>
    </div>
  </div>

  <template v-else>
    <div m="b-0 t-0" relative w-full h-full :class="gridClass">
      <slot />
    </div>
    <slot name="end" />
  </template>
</template>

<style lang="scss" scoped>
.grid-adaptive {
  --uno: "grid 2xl:cols-5 xl:cols-4 lg:cols-3 md:cols-2 sm:cols-1 cols-1 gap-5";
}

.grid-adaptive-wide {
  --uno: "grid 2xl:cols-4 xl:cols-3 lg:cols-2 md:cols-1 sm:cols-1 cols-1 gap-5";
}

.grid-adaptive-bangumi {
  --uno: "grid 2xl:cols-5 xl:cols-4 lg:cols-3 md:cols-2 gap-5";
}

.grid-two-columns {
  --uno: "grid cols-1 xl:cols-2 gap-4";
}

.grid-one-column {
  --uno: "grid cols-1 gap-4";
}

.horizontal-scroller {
  // 顶栏 + 首页标签栏和它下方的间距，再留一点底边
  height: calc(100vh - var(--bew-top-bar-height) - 74px);
  box-sizing: content-box;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
}

.grid-horizontal-scroll {
  display: grid;
  grid-auto-flow: column;
  align-items: start;
  height: 100%;

  // 卡片是插槽内容，要用 :deep 才能选中
  > :deep(*) {
    zoom: var(--card-scale);
    // 卡片根元素的过渡没写属性，默认是 all，缩放也会被做成动画。只保留悬停效果用到的属性
    transition-property: background-color, box-shadow;
  }

  :deep([data-measuring]),
  :deep([data-measuring] *) {
    content-visibility: visible !important;
  }
}
</style>
