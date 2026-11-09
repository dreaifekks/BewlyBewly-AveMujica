<script setup lang="ts">
import { singleImageRatio, thumbnailUrl } from '../momentsData'
import type { MomentImage } from '../types'

const props = defineProps<{
  images: MomentImage[]
}>()

const emit = defineEmits<{
  (e: 'view', images: MomentImage[], index: number): void
}>()

/** 最多显示 9 张，第 9 张上标出还有几张 */
const MAX_SHOWN = 9

const shown = computed(() => props.images.slice(0, MAX_SHOWN))
const columns = computed(() => props.images.length === 2 || props.images.length === 4 ? 2 : 3)
const single = computed(() => props.images.length === 1 ? props.images[0] : null)
const singleRatio = computed(() => single.value ? singleImageRatio(single.value) : 1)
</script>

<template>
  <div v-if="single" class="moment-images single" :class="{ portrait: singleRatio < 1 }">
    <img
      :src="thumbnailUrl(single.url, 720)" alt="" loading="lazy"
      :style="{ aspectRatio: `${singleRatio}` }"
      @click.stop="emit('view', images, 0)"
    >
  </div>
  <div v-else class="moment-images" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
    <div v-for="(image, index) in shown" :key="index" class="cell">
      <img
        :src="thumbnailUrl(image.url, columns === 2 ? 450 : 300, columns === 2 ? 450 : 300)" alt="" loading="lazy"
        @click.stop="emit('view', images, index)"
      >
      <span v-if="index === MAX_SHOWN - 1 && images.length > MAX_SHOWN" class="more">+{{ images.length - MAX_SHOWN }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.moment-images {
  display: grid;
  gap: 4px;
  border-radius: 10px;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: zoom-in;
    transition: transform 0.4s;
  }

  &.single {
    display: block;
    width: 100%;
    background: var(--bew-skeleton);

    &.portrait {
      width: 72%;
    }

    img {
      height: auto;
      max-height: 440px;
    }
  }
}

.cell {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bew-skeleton);

  &:hover img {
    transform: scale(1.04);
  }
}

.more {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 45%);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  pointer-events: none;
}
</style>
