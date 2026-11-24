<script setup lang="ts">
import type { RichSegment } from '../types'

defineProps<{
  segments: RichSegment[]
}>()
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <img
      v-if="segment.kind === 'emoji'"
      :src="segment.url" :alt="segment.text" :title="segment.text"
      class="moment-emoji" :class="{ large: segment.large }"
      loading="lazy"
    >
    <a
      v-else-if="segment.kind === 'link'"
      :href="segment.url" target="_blank" rel="noopener"
      class="moment-link"
    >{{ segment.text }}</a>
    <span v-else>{{ segment.text }}</span>
  </template>
</template>

<style scoped>
.moment-emoji {
  display: inline-block;
  width: 1.4em;
  height: 1.4em;
  margin: 0 1px;
  vertical-align: text-bottom;

  &.large {
    width: 3em;
    height: 3em;
  }
}

.moment-link {
  color: var(--bew-theme-color);

  &:hover {
    text-decoration: underline;
  }
}
</style>
