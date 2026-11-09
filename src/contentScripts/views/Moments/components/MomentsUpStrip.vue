<script setup lang="ts">
import { useEventListener, useResizeObserver } from '@vueuse/core'

import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'
import { createWheelAxisLock } from '~/utils/wheelAxisLock'

import { thumbnailUrl } from '../momentsData'
import type { MomentsLiveUser, MomentsUp } from '../types'
import MomentAvatar from './MomentAvatar.vue'

const props = defineProps<{
  ups: MomentsUp[]
  liveUsers: MomentsLiveUser[]
  selectedMid: string | null
  /** 「全部关注」打开的关注列表 */
  followingUrl: string
}>()

const emit = defineEmits<{
  (e: 'select', mid: string | null): void
}>()

const { mainAppRef } = useBewlyApp()

// 正在直播的排在最前，后面的 UP 主里不再重复
const liveMids = computed(() => new Set(props.liveUsers.map(u => u.mid)))
const otherUps = computed(() => props.ups.filter(u => !liveMids.value.has(u.mid)))

/* ---------- 横向滚动和两侧按钮 ---------- */
const scroller = useTemplateRef<HTMLElement>('scroller')
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateArrows() {
  const el = scroller.value
  if (!el)
    return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function scrollByPage(direction: -1 | 1) {
  const el = scroller.value
  if (el)
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' })
}

useResizeObserver(scroller, updateArrows)
watch(() => [props.ups.length, props.liveUsers.length], () => nextTick(updateArrows))
useEventListener(scroller, 'scroll', () => {
  updateArrows()
  hidePopover()
}, { passive: true })

// 打开「横向滚动」设置时，竖着滚滚轮也能横着滚头像栏；滚到头了就交还给页面
const wheelAxisLock = createWheelAxisLock()
useEventListener(scroller, 'wheel', (event: WheelEvent) => {
  const el = scroller.value
  if (!el || !settings.value.enableHorizontalScrolling || event.ctrlKey)
    return
  if (wheelAxisLock(event.deltaX, event.deltaY, event.timeStamp) !== 'y')
    return
  const atStart = el.scrollLeft <= 0 && event.deltaY < 0
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0
  if (atStart || atEnd)
    return
  event.preventDefault()
  el.scrollLeft += event.deltaY
}, { passive: false })

/* ---------- 悬停直播头像的浮层 ---------- */
const popoverUser = ref<MomentsLiveUser | null>(null)
const popoverStyle = ref<{ left: string, top: string }>({ left: '0px', top: '0px' })
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

const POPOVER_WIDTH = 288

function handleLiveEnter(user: MomentsLiveUser, event: MouseEvent) {
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
  if (popoverUser.value?.mid === user.mid)
    return
  const item = event.currentTarget as HTMLElement
  showTimer = setTimeout(() => {
    const rect = item.getBoundingClientRect()
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - POPOVER_WIDTH / 2), window.innerWidth - POPOVER_WIDTH - 8)
    popoverStyle.value = { left: `${left}px`, top: `${rect.bottom + 10}px` }
    popoverUser.value = user
  }, 140)
}

function cancelHide() {
  clearTimeout(hideTimer)
}

function handleLiveLeave() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hidePopover, 200)
}

function hidePopover() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  popoverUser.value = null
}

useEventListener(window, 'scroll', () => {
  if (popoverUser.value)
    hidePopover()
}, { passive: true })

onBeforeUnmount(hidePopover)

function onlyTheirMoments(mid: string) {
  hidePopover()
  emit('select', mid)
}
</script>

<template>
  <section
    class="up-strip"
    :class="{ 'can-left': canScrollLeft, 'can-right': canScrollRight }"
  >
    <div ref="scroller" class="up-scroll">
      <button class="up-item all" :class="{ selected: !selectedMid }" @click="emit('select', null)">
        <span class="up-avatar">
          <span class="icon-avatar"><i i-tabler:windmill /></span>
        </span>
        <span class="up-name">{{ $t('moments.all_moments') }}</span>
      </button>

      <template v-if="liveUsers.length">
        <a
          v-for="user in liveUsers" :key="`live-${user.mid}`"
          :href="user.roomUrl" target="_blank" rel="noopener"
          class="up-item is-live" :class="{ selected: selectedMid === user.mid }"
          @mouseenter="handleLiveEnter(user, $event)"
          @mouseleave="handleLiveLeave"
        >
          <span class="up-avatar">
            <MomentAvatar :face="user.face" :size="48" live :selected="selectedMid === user.mid" />
            <span class="live-pill">{{ $t('moments.live') }}</span>
          </span>
          <span class="up-name">{{ user.name }}</span>
        </a>
        <span class="up-separator" />
      </template>

      <button
        v-for="up in otherUps" :key="up.mid"
        class="up-item" :class="{ selected: selectedMid === up.mid }"
        :title="up.name"
        @click="emit('select', up.mid)"
      >
        <span class="up-avatar">
          <MomentAvatar :face="up.face" :size="48" :selected="selectedMid === up.mid" />
          <span v-if="up.hasUpdate && selectedMid !== up.mid" class="update-dot" />
        </span>
        <span class="up-name">{{ up.name }}</span>
      </button>

      <a :href="followingUrl" target="_blank" rel="noopener" class="up-item">
        <span class="up-avatar">
          <span class="icon-avatar"><i i-mingcute:user-3-line /></span>
        </span>
        <span class="up-name">{{ $t('moments.all_following') }}</span>
      </a>
    </div>

    <button class="strip-btn left" :title="$t('moments.scroll_left')" @click="scrollByPage(-1)">
      <i i-mingcute:left-line />
    </button>
    <button class="strip-btn right" :title="$t('moments.scroll_right')" @click="scrollByPage(1)">
      <i i-mingcute:right-line />
    </button>

    <Teleport :to="mainAppRef">
      <Transition name="moment-popover">
        <div
          v-if="popoverUser"
          class="live-popover"
          :style="popoverStyle"
          @mouseenter="cancelHide"
          @mouseleave="handleLiveLeave"
        >
          <a v-if="popoverUser.cover" :href="popoverUser.roomUrl" target="_blank" rel="noopener" class="popover-cover">
            <img :src="thumbnailUrl(popoverUser.cover, 576, 324)" alt="">
            <span class="shade" />
            <span class="live-badge"><i i-svg-spinners:pulse-3 />{{ $t('moments.live') }}</span>
            <span v-if="popoverUser.watched" class="watched">
              <i i-mingcute:eye-2-line />{{ $t('moments.watched', { count: popoverUser.watched }) }}
            </span>
          </a>
          <div class="popover-title">
            {{ popoverUser.title }}
          </div>
          <div class="popover-sub">
            {{ [popoverUser.name, popoverUser.area].filter(Boolean).join(' · ') }}
          </div>
          <div class="popover-buttons">
            <a :href="popoverUser.roomUrl" target="_blank" rel="noopener" class="popover-btn primary" @click="hidePopover">
              <i i-fluent:live-24-filled />{{ $t('moments.enter_live_room') }}
            </a>
            <button class="popover-btn ghost" @click="onlyTheirMoments(popoverUser.mid)">
              {{ $t('moments.only_their_moments') }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped lang="scss">
.up-strip {
  position: relative;
  margin-bottom: 16px;
  border-radius: var(--bew-radius);
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated);
  backdrop-filter: var(--bew-filter-glass-1);
  box-shadow: var(--bew-shadow-1), var(--bew-shadow-edge-glow-1);

  &.can-right .up-scroll {
    mask-image: linear-gradient(to right, #000 calc(100% - 72px), transparent);
  }

  &.can-left .up-scroll {
    mask-image: linear-gradient(to right, transparent, #000 72px);
  }

  &.can-left.can-right .up-scroll {
    mask-image: linear-gradient(to right, transparent, #000 72px, #000 calc(100% - 72px), transparent);
  }

  &.can-left .strip-btn.left,
  &.can-right .strip-btn.right {
    display: grid;
  }
}

.up-scroll {
  display: flex;
  gap: 2px;
  padding: 14px 10px 10px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.up-item {
  flex: 0 0 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 6px 0 4px;
  border-radius: 10px;
  color: inherit;
  transition: background 0.2s;

  &:hover {
    background: var(--bew-fill-1);
  }

  &.selected .up-name,
  &.is-live .up-name {
    color: var(--bew-text-1);
  }

  &.selected .up-name {
    font-weight: 700;
  }

  &.all .icon-avatar {
    color: var(--bew-theme-color);
  }

  &.all.selected .icon-avatar {
    box-shadow:
      0 0 0 2.5px var(--bew-elevated-solid),
      0 0 0 4.5px var(--bew-text-1);
  }
}

.up-avatar {
  position: relative;
  display: grid;
  place-items: center;
}

.icon-avatar {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bew-fill-1);
  color: var(--bew-text-2);
  font-size: 22px;
  transition: box-shadow 0.2s;
}

.up-name {
  max-width: 66px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--bew-text-2);
}

.update-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--bew-elevated-solid);
  background: var(--bew-theme-color);
}

.live-pill {
  position: absolute;
  bottom: -7px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  padding: 0 6px;
  border-radius: 999px;
  border: 1.5px solid var(--bew-elevated-solid);
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  white-space: nowrap;
}

.up-separator {
  flex: 0 0 1px;
  margin: 10px 8px 28px;
  background: var(--bew-border-color);
}

.strip-btn {
  position: absolute;
  top: 37px;
  z-index: 3;
  display: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated-solid);
  box-shadow: var(--bew-shadow-2);
  font-size: 16px;
  transform: translateY(-50%);

  &.left {
    left: 8px;
  }

  &.right {
    right: 8px;
  }
}

.live-popover {
  position: fixed;
  z-index: 1000;
  width: 288px;
  padding: 10px;
  border-radius: var(--bew-radius);
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated);
  backdrop-filter: var(--bew-filter-glass-2);
  box-shadow: var(--bew-shadow-3), var(--bew-shadow-edge-glow-1);
  color: var(--bew-text-1);
}

.popover-cover {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  margin-bottom: 10px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bew-skeleton);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .shade {
    position: absolute;
    inset: auto 0 0;
    height: 45%;
    background: linear-gradient(transparent, rgb(0 0 0 / 55%));
  }

  .live-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--bew-radius);
    background: var(--bew-theme-color);
    color: #fff;
    font-size: 11.5px;
    font-weight: 700;
  }

  .watched {
    position: absolute;
    left: 10px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #fff;
    font-size: 12.5px;
    text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
  }
}

.popover-title {
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.45;
}

.popover-sub {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--bew-text-3);
}

.popover-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.popover-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  transition:
    background 0.2s,
    filter 0.2s;

  &.primary {
    background: var(--bew-theme-color);
    color: #fff;

    &:hover {
      filter: brightness(1.08);
    }
  }

  &.ghost {
    background: var(--bew-fill-1);
    color: var(--bew-text-1);

    &:hover {
      background: var(--bew-fill-2);
    }
  }
}

.moment-popover-enter-active,
.moment-popover-leave-active {
  transition:
    opacity 0.18s,
    transform 0.18s;
}

.moment-popover-enter-from,
.moment-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
