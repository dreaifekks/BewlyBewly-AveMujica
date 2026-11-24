<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useDocumentScrollLock } from '~/composables/useDocumentScrollLock'

import { toHttps } from '../momentsData'
import type { MomentImage } from '../types'

const props = defineProps<{
  images: MomentImage[]
  startIndex: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { mainAppRef } = useBewlyApp()
useDocumentScrollLock()

const index = ref(props.startIndex)
const current = computed(() => props.images[index.value])
const multiple = computed(() => props.images.length > 1)

function go(step: -1 | 1) {
  index.value = (index.value + step + props.images.length) % props.images.length
}

onKeyStroke('Escape', (event) => {
  event.preventDefault()
  emit('close')
})
onKeyStroke('ArrowLeft', () => multiple.value && go(-1))
onKeyStroke('ArrowRight', () => multiple.value && go(1))
</script>

<template>
  <Teleport :to="mainAppRef">
    <div class="image-viewer" @click.self="emit('close')" @wheel.prevent>
      <img v-if="current" :key="current.url" :src="toHttps(current.url)" alt="">
      <button class="viewer-btn close" :title="$t('moments.close')" @click="emit('close')">
        <i i-mingcute:close-line />
      </button>
      <template v-if="multiple">
        <button class="viewer-btn prev" @click="go(-1)">
          <i i-mingcute:left-line />
        </button>
        <button class="viewer-btn next" @click="go(1)">
          <i i-mingcute:right-line />
        </button>
        <div class="viewer-count">
          {{ index + 1 }} / {{ images.length }}
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.image-viewer {
  position: fixed;
  inset: 0;
  z-index: 10005;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 86%);
  animation: moment-viewer-fade 0.2s;

  img {
    max-width: 84vw;
    max-height: 84vh;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgb(0 0 0 / 50%);
  }
}

@keyframes moment-viewer-fade {
  from {
    opacity: 0;
  }
}

.viewer-btn {
  position: absolute;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgb(255 255 255 / 12%);
  color: #fff;
  font-size: 22px;
  transition: background 0.2s;

  &:hover {
    background: rgb(255 255 255 / 22%);
  }

  &.close {
    top: 20px;
    right: 20px;
  }

  &.prev,
  &.next {
    top: 50%;
    transform: translateY(-50%);
  }

  &.prev {
    left: 24px;
  }

  &.next {
    right: 24px;
  }
}

.viewer-count {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  color: rgb(255 255 255 / 80%);
  font-size: 13px;
}
</style>
