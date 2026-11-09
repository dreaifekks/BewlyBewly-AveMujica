<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import api from '~/utils/api'
import { numFormatter } from '~/utils/dataFormatter'
import { getCSRF } from '~/utils/main'

import { thumbnailUrl } from '../momentsData'
import type { MomentVideo } from '../types'

const props = defineProps<{
  video: MomentVideo
  /** 转发里的原动态用左图右文的紧凑样式 */
  compact?: boolean
}>()

const { t } = useI18n()
const toast = useToast()

const canWatchLater = computed(() => !props.compact && !!props.video.aid)
const inWatchLater = ref(false)
const watchLaterBusy = ref(false)

/** 播放数和弹幕数是B站格式化好的字符串，纯数字时再按 Bewly 的格式显示 */
function formatCount(value?: string): string {
  if (!value)
    return ''
  return /^\d+$/.test(value) ? numFormatter(value) : value
}

async function toggleWatchLater() {
  if (!props.video.aid || watchLaterBusy.value)
    return
  watchLaterBusy.value = true
  try {
    const params = { aid: Number(props.video.aid), csrf: getCSRF() }
    const res = inWatchLater.value
      ? await api.watchlater.removeFromWatchLater(params)
      : await api.watchlater.saveToWatchLater(params)
    if (res.code === 0)
      inWatchLater.value = !inWatchLater.value
    else
      toast.error(res.message || t('common.operation_failed'))
  }
  catch (error) {
    console.error(error)
    toast.error(t('common.operation_failed'))
  }
  finally {
    watchLaterBusy.value = false
  }
}
</script>

<template>
  <ALink
    :href="video.url" type="videoCard"
    class="moment-video" :class="{ compact }"
  >
    <div class="cover">
      <img :src="thumbnailUrl(video.cover, 672, 378)" alt="" loading="lazy">
      <template v-if="!compact">
        <span class="shade" />
        <span v-if="video.play || video.danmaku" class="stats">
          <template v-if="video.play">
            <i i-mingcute:play-circle-line />{{ formatCount(video.play) }}
          </template>
          <template v-if="video.danmaku">
            <i i-mingcute:danmaku-line ml-2 />{{ formatCount(video.danmaku) }}
          </template>
        </span>
        <span v-if="video.badge" class="badge" :class="canWatchLater ? 'left' : 'right'">{{ video.badge }}</span>
        <button
          v-if="canWatchLater"
          class="watch-later" :class="{ active: inWatchLater }"
          :title="inWatchLater ? $t('common.added') : $t('common.save_to_watch_later')"
          @click.prevent.stop="toggleWatchLater"
        >
          <i v-if="inWatchLater" i-mingcute:check-line />
          <i v-else i-mingcute:carplay-line />
        </button>
      </template>
      <span v-if="video.duration" class="duration">{{ video.duration }}</span>
    </div>
    <div class="info">
      <div class="title">
        {{ video.title }}
      </div>
      <div v-if="compact && (video.play || video.danmaku)" class="desc meta">
        <template v-if="video.play">
          <i i-mingcute:play-circle-line />{{ formatCount(video.play) }}
        </template>
        <template v-if="video.danmaku">
          · {{ $t('common.danmaku', { count: formatCount(video.danmaku) }) }}
        </template>
      </div>
      <div v-else-if="video.desc && !compact" class="desc">
        {{ video.desc }}
      </div>
    </div>
  </ALink>
</template>

<style scoped lang="scss">
.moment-video {
  display: block;
  color: inherit;

  &:hover .title {
    color: var(--bew-theme-color);
  }

  &:hover .cover img {
    transform: scale(1.03);
  }

  &.compact {
    display: flex;
    gap: 10px;

    .cover {
      flex: 0 0 44%;
    }

    .info {
      min-width: 0;
    }

    .title {
      margin-top: 0;
      font-size: 14px;
    }
  }
}

.cover {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bew-skeleton);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s;
  }

  &:hover .watch-later {
    opacity: 1;
    transform: none;
  }
}

.shade {
  position: absolute;
  inset: auto 0 0;
  height: 45%;
  background: linear-gradient(transparent, rgb(0 0 0 / 55%));
  pointer-events: none;
}

.stats {
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

.duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 8px;
  border-radius: var(--bew-radius);
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-size: 12px;
}

.badge {
  position: absolute;
  top: 6px;
  padding: 2px 8px;
  border-radius: var(--bew-radius);
  background: var(--bew-bili-pink);
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;

  &.left {
    left: 6px;
  }

  &.right {
    right: 6px;
  }
}

.watch-later {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  border-radius: var(--bew-radius);
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-size: 18px;
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 0.3s,
    transform 0.3s;

  &.active {
    opacity: 1;
    transform: none;
  }
}

.title {
  margin-top: 10px;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.3s;
}

.desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--bew-text-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  &.meta {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
</style>
