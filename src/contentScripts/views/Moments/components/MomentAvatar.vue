<script setup lang="ts">
import { thumbnailUrl } from '../momentsData'

const props = withDefaults(defineProps<{
  face: string
  size?: number
  /** 正在直播：外面加一圈转动的环 */
  live?: boolean
  selected?: boolean
}>(), {
  size: 38,
})

const src = computed(() => {
  const px = Math.ceil(props.size * 2)
  return thumbnailUrl(props.face, px, px)
})
</script>

<template>
  <span class="moment-avatar" :class="{ selected }" :style="{ '--size': `${size}px` }">
    <img :src="src" alt="" loading="lazy">
    <i v-if="live" class="ring" />
  </span>
</template>

<style scoped>
.moment-avatar {
  position: relative;
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  transition: box-shadow 0.2s;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    background: var(--bew-skeleton);
  }

  &.selected {
    box-shadow:
      0 0 0 2.5px var(--bew-elevated-solid),
      0 0 0 4.5px var(--bew-text-1);
  }
}

.ring {
  position: absolute;
  inset: calc(-1 * (2.5px + max(2px, var(--size) * 0.06)));
  border-radius: 50%;
  background: conic-gradient(
    var(--bew-theme-color),
    color-mix(in oklab, var(--bew-theme-color), #fff 60%),
    var(--bew-theme-color) 50%,
    color-mix(in oklab, var(--bew-theme-color), #fff 60%) 75%,
    var(--bew-theme-color)
  );
  mask: radial-gradient(farthest-side, transparent calc(100% - 2.6px), #000 calc(100% - 2px));
  animation: moment-avatar-spin 2.6s linear infinite;
  pointer-events: none;
}

@keyframes moment-avatar-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
