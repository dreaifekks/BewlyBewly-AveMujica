<script setup lang="ts">
import { thumbnailUrl } from '../momentsData'
import type { MomentEntry, MomentImage, MomentOpenTarget } from '../types'
import MomentImages from './MomentImages.vue'
import MomentRichText from './MomentRichText.vue'
import MomentVideoBlock from './MomentVideoBlock.vue'

const props = defineProps<{
  entry: MomentEntry
  /** 转发里的原动态 */
  nested?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', target: MomentOpenTarget, event: MouseEvent): void
  (e: 'viewImages', images: MomentImage[], index: number): void
}>()

const textRef = useTemplateRef<HTMLElement>('text')
const expanded = ref(false)
/** 正文超过 6 行被折叠了 */
const clamped = ref(false)

onMounted(() => {
  const el = textRef.value
  if (el)
    clamped.value = el.scrollHeight > el.clientHeight + 2
})

const content = computed(() => props.entry.content)
const showFullTextLink = computed(() => !props.nested && props.entry.textTruncated && (expanded.value || !clamped.value))
</script>

<template>
  <div class="moment-body" :class="{ nested }">
    <div v-if="entry.title" class="opus-title">
      {{ entry.title }}
    </div>

    <template v-if="entry.text.length">
      <div ref="text" class="text" :class="{ clamp: !expanded }">
        <MomentRichText :segments="entry.text" />
      </div>
      <button v-if="clamped && !expanded && !nested" class="text-btn" @click.stop="expanded = true">
        {{ $t('moments.expand') }}
      </button>
      <button v-else-if="showFullTextLink" class="text-btn" @click.stop="emit('open', entry.open, $event)">
        {{ $t('moments.full_text') }}
      </button>
    </template>

    <!-- 视频、番剧、合集、课程 -->
    <MomentVideoBlock
      v-if="content.kind === 'video'"
      :video="content.video" :compact="nested"
      class="media"
    />

    <!-- 图片 -->
    <MomentImages
      v-else-if="content.kind === 'images'"
      :images="content.images"
      class="media"
      @view="(images, index) => emit('viewImages', images, index)"
    />

    <!-- 文章：点卡片打开 -->
    <div v-else-if="content.kind === 'article'" class="media article">
      <div v-if="content.article.cover" class="article-cover">
        <img :src="thumbnailUrl(content.article.cover, 880, 400)" alt="" loading="lazy">
        <span class="article-badge">{{ $t('moments.article') }}</span>
      </div>
      <div class="article-title">
        {{ content.article.title }}
      </div>
      <div v-if="content.article.summary" class="article-summary">
        {{ content.article.summary }}
      </div>
    </div>

    <!-- 直播 -->
    <a
      v-else-if="content.kind === 'live'"
      :href="content.live.url" target="_blank" rel="noopener"
      class="media live"
    >
      <div class="live-cover">
        <img :src="thumbnailUrl(content.live.cover, 672, 378)" alt="" loading="lazy">
        <span class="shade" />
        <span class="live-badge" :class="{ ended: content.live.ended }">
          <i v-if="!content.live.ended" i-svg-spinners:pulse-3 />
          {{ content.live.ended ? $t('moments.live_ended') : $t('moments.live') }}
        </span>
        <span v-if="content.live.watched" class="live-watched">
          <i i-mingcute:eye-2-line />{{ content.live.watched }}
        </span>
      </div>
      <div class="live-title">{{ content.live.title }}</div>
      <div v-if="content.live.area" class="live-area">{{ content.live.area }}</div>
    </a>

    <!-- 音乐、装扮、课程之类的附件 -->
    <component
      :is="content.attachment.url ? 'a' : 'div'"
      v-else-if="content.kind === 'attachment'"
      :href="content.attachment.url || undefined"
      :target="content.attachment.url ? '_blank' : undefined"
      rel="noopener"
      class="media attachment"
    >
      <img v-if="content.attachment.cover" :src="thumbnailUrl(content.attachment.cover, 160, 160)" alt="" loading="lazy">
      <div min-w-0>
        <div class="attachment-title">
          {{ content.attachment.title }}
        </div>
        <div v-if="content.attachment.desc" class="attachment-desc">
          {{ content.attachment.desc }}
        </div>
      </div>
      <span v-if="content.attachment.badge" class="attachment-badge">{{ content.attachment.badge }}</span>
    </component>

    <!-- 转发：点原动态打开原动态 -->
    <template v-else-if="content.kind === 'forward'">
      <div
        v-if="content.orig"
        class="media orig"
        @click.stop="emit('open', content.orig.open, $event)"
      >
        <div class="orig-head">
          <a :href="content.orig.author.spaceUrl" target="_blank" rel="noopener" class="orig-name" @click.stop>@{{ content.orig.author.name }}</a>
          <span v-if="content.orig.time" class="orig-time">{{ content.orig.time }}</span>
        </div>
        <MomentBody
          :entry="content.orig" nested
          @open="(target, event) => emit('open', target, event)"
          @view-images="(images, index) => emit('viewImages', images, index)"
        />
      </div>
      <div v-else class="media orig deleted">
        {{ content.tip || $t('moments.original_deleted') }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.opus-title {
  margin-bottom: 6px;
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.45;
}

.text {
  font-size: 14.8px;
  line-height: 1.68;
  white-space: pre-wrap;
  word-break: break-word;

  &.clamp {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.text-btn {
  margin-top: 2px;
  color: var(--bew-theme-color);
  font-size: 14px;

  &:hover {
    text-decoration: underline;
  }
}

.media {
  margin-top: 10px;
}

.opus-title + .media {
  margin-top: 4px;
}

.moment-body > .media:first-child {
  margin-top: 0;
}

.nested {
  .text {
    font-size: 14px;
  }

  .media {
    margin-top: 8px;
  }
}

.article {
  cursor: pointer;

  &:hover {
    .article-title {
      color: var(--bew-theme-color);
    }

    .article-cover img {
      transform: scale(1.03);
    }
  }
}

.article-cover {
  position: relative;
  aspect-ratio: 2.2 / 1;
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
}

.article-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: var(--bew-radius);
  background: var(--bew-theme-color);
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;
}

.article-title {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
  transition: color 0.3s;
}

.article-cover + .article-title {
  margin-top: 10px;
}

.article-title:first-child {
  margin-top: 0;
}

.article-summary {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.62;
  color: var(--bew-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}

.live {
  display: block;
  color: inherit;

  &:hover {
    .live-title {
      color: var(--bew-theme-color);
    }

    .live-cover img {
      transform: scale(1.03);
    }
  }
}

.live-cover {
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
}

.shade {
  position: absolute;
  inset: auto 0 0;
  height: 45%;
  background: linear-gradient(transparent, rgb(0 0 0 / 55%));
  pointer-events: none;
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

  &.ended {
    background: rgb(0 0 0 / 60%);
  }
}

.live-watched {
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

.live-title {
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

.live-area {
  margin-top: 4px;
  font-size: 13px;
  color: var(--bew-text-3);
}

.attachment {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  background: var(--bew-fill-1);
  color: inherit;
  transition: background 0.2s;

  &:hover {
    background: var(--bew-fill-2);
  }

  img {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
  }
}

.attachment-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--bew-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-badge {
  margin-left: auto;
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bew-theme-color-20);
  color: var(--bew-theme-color);
  font-size: 12px;
}

.orig {
  padding: 12px;
  border-radius: 10px;
  background: var(--bew-fill-1);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bew-fill-2);
  }

  &.deleted {
    cursor: default;
    color: var(--bew-text-3);
    font-size: 13.5px;

    &:hover {
      background: var(--bew-fill-1);
    }
  }
}

.orig-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13.5px;
}

.orig-name {
  color: var(--bew-theme-color);
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.orig-time {
  color: var(--bew-text-3);
  font-size: 12px;
}
</style>
