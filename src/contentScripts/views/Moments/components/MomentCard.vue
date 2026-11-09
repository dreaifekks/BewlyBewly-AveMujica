<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import api from '~/utils/api'
import { numFormatter } from '~/utils/dataFormatter'
import { getCSRF } from '~/utils/main'

import type { MomentEntry, MomentImage } from '../types'
import { commentTargetOf, detailTargetOf, useMomentOpener } from '../useMomentOpener'
import MomentAvatar from './MomentAvatar.vue'
import MomentBody from './MomentBody.vue'

const props = defineProps<{
  entry: MomentEntry
  /** 作者正在直播 */
  authorLive?: boolean
  /** 刚刷新出来的新动态，闪一下 */
  fresh?: boolean
}>()

const emit = defineEmits<{
  (e: 'viewImages', images: MomentImage[], index: number): void
}>()

const { t } = useI18n()
const toast = useToast()
const open = useMomentOpener()

const subtitle = computed(() => [props.entry.time, props.entry.action].filter(Boolean).join(' · '))

const liked = ref(props.entry.stats.liked)
const likeCount = ref(props.entry.stats.like)
const likeBusy = ref(false)

function formatStat(count: number, label: string): string {
  return count > 0 ? numFormatter(count) : label
}

// 点卡片空白处打开动态；链接、按钮自己处理，选中文字时不打开
function handleCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('a, button'))
    return
  if (window.getSelection()?.toString())
    return
  open(props.entry.open, event)
}

// 先改界面，请求失败再改回来
async function toggleLike() {
  if (likeBusy.value)
    return
  likeBusy.value = true
  const nextLiked = !liked.value
  liked.value = nextLiked
  likeCount.value = Math.max(0, likeCount.value + (nextLiked ? 1 : -1))
  try {
    const res = await api.moment.likeMoment({
      dyn_id_str: props.entry.id,
      up: nextLiked ? 1 : 2,
      csrf: getCSRF(),
    })
    if (res.code !== 0)
      throw new Error(res.message || `likeMoment failed with code ${res.code}`)
  }
  catch (error) {
    console.error(error)
    liked.value = !nextLiked
    likeCount.value = Math.max(0, likeCount.value + (nextLiked ? -1 : 1))
    toast.error(t('moments.like_failed'))
  }
  finally {
    likeBusy.value = false
  }
}
</script>

<template>
  <article class="moment-card" :class="{ fresh }" :data-moment-id="entry.id" @click="handleCardClick">
    <header class="head">
      <a :href="entry.author.spaceUrl" target="_blank" rel="noopener" class="avatar-link">
        <MomentAvatar :face="entry.author.face" :size="38" :live="authorLive" />
      </a>
      <div class="meta">
        <a :href="entry.author.spaceUrl" target="_blank" rel="noopener" class="name" :class="{ vip: entry.author.vip }">{{ entry.author.name }}</a>
        <div v-if="subtitle" class="sub">
          {{ subtitle }}
        </div>
      </div>
    </header>

    <MomentBody
      :entry="entry"
      @open="(target, event) => open(target, event)"
      @view-images="(images, index) => emit('viewImages', images, index)"
    />

    <footer class="foot">
      <button class="action" :title="$t('moments.forward')" @click="open(detailTargetOf(entry), $event)">
        <i i-mingcute:share-forward-line />
        <span>{{ formatStat(entry.stats.forward, $t('moments.forward')) }}</span>
      </button>
      <button class="action" :title="$t('moments.comment')" @click="open(commentTargetOf(entry), $event)">
        <i i-mingcute:chat-1-line />
        <span>{{ formatStat(entry.stats.comment, $t('moments.comment')) }}</span>
      </button>
      <button class="action" :class="{ liked }" :title="$t('moments.like')" @click="toggleLike">
        <i :class="liked ? 'i-mingcute:thumb-up-2-fill' : 'i-mingcute:thumb-up-2-line'" />
        <span>{{ formatStat(likeCount, $t('moments.like')) }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.moment-card {
  position: relative;
  padding: 14px 16px 6px;
  border-radius: var(--bew-radius);
  border: 1px solid var(--bew-border-color);
  background: var(--bew-elevated);
  backdrop-filter: var(--bew-filter-glass-1);
  box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-1);
  cursor: pointer;
  transition:
    box-shadow 0.3s,
    border-color 0.3s;
  animation: moment-card-rise 0.35s ease both;

  &:hover {
    border-color: var(--bew-fill-3);
    box-shadow: var(--bew-shadow-edge-glow-1), var(--bew-shadow-2);
  }

  &.fresh {
    animation:
      moment-card-rise 0.35s ease both,
      moment-card-fresh 2.2s ease 0.2s;
  }
}

@keyframes moment-card-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@keyframes moment-card-fresh {
  0%,
  40% {
    box-shadow:
      0 0 0 3px var(--bew-theme-color-60),
      var(--bew-shadow-2);
  }
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.avatar-link {
  display: flex;
}

.meta {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  width: fit-content;
  max-width: 100%;
  font-size: 14.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--bew-text-1);
  transition: color 0.2s;

  &.vip {
    color: var(--bew-bili-pink);
  }

  &:hover {
    color: var(--bew-theme-color);
  }
}

.sub {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--bew-text-3);
}

.foot {
  display: flex;
  margin: 8px -8px 0;
}

.action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  border-radius: 8px;
  color: var(--bew-text-2);
  font-size: 13px;
  transition:
    background 0.2s,
    color 0.2s;

  i {
    font-size: 17px;
  }

  &:hover {
    background: var(--bew-fill-1);
    color: var(--bew-text-1);
  }

  &.liked {
    color: var(--bew-theme-color);

    i {
      animation: moment-card-pop 0.3s ease;
    }
  }
}

@keyframes moment-card-pop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}
</style>
