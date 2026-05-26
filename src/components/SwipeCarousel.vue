<template>
  <div class="swipe-carousel">
    <div ref="trackRef" class="swipe-carousel-track" :aria-label="ariaLabel" @scroll.passive="handleScroll">
      <div v-for="(item, index) in items" :key="item.key" class="swipe-carousel-slide">
        <slot :active="index === activeIndex" :index="index" :item="item" />
      </div>
    </div>

    <div v-if="items.length > 1" class="swipe-carousel-dots">
      <button
        v-for="(item, index) in items"
        :key="`${item.key}-dot`"
        :aria-label="`切换到第 ${index + 1} 项`"
        :class="['swipe-carousel-dot', { active: index === activeIndex }]"
        type="button"
        @click="scrollToIndex(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

type CarouselItem = {
  key: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    items: CarouselItem[]
    ariaLabel?: string
  }>(),
  {
    ariaLabel: '轮播内容',
  },
)

defineSlots<{
  default(props: {
    active: boolean
    index: number
    item: any
  }): any
}>()

const trackRef = ref<HTMLDivElement | null>(null)
const activeIndex = ref(0)

function clampIndex(index: number): number {
  if (props.items.length === 0) {
    return 0
  }

  return Math.min(Math.max(index, 0), props.items.length - 1)
}

function syncIndexFromScroll(): void {
  const track = trackRef.value
  if (!track) {
    return
  }

  const nextIndex = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))
  activeIndex.value = clampIndex(nextIndex)
}

function handleScroll(): void {
  syncIndexFromScroll()
}

function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
  const track = trackRef.value
  const targetIndex = clampIndex(index)

  activeIndex.value = targetIndex

  if (!track) {
    return
  }

  const slide = track.children.item(targetIndex)
  if (!(slide instanceof HTMLElement)) {
    return
  }

  slide.scrollIntoView({
    behavior,
    block: 'nearest',
    inline: 'start',
  })
}

watch(
  () => props.items.map((item) => item.key).join('|'),
  async () => {
    activeIndex.value = clampIndex(activeIndex.value)
    await nextTick()
    scrollToIndex(activeIndex.value, 'auto')
  },
  { immediate: true },
)
</script>

<style scoped>
.swipe-carousel {
  display: grid;
  gap: 10px;
}

.swipe-carousel-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.swipe-carousel-track::-webkit-scrollbar {
  display: none;
}

.swipe-carousel-slide {
  flex: 0 0 100%;
  min-width: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.swipe-carousel-dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.swipe-carousel-dot {
  width: 8px;
  height: 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(17, 19, 24, 0.16);
  cursor: pointer;
  transition: transform 160ms ease, background-color 160ms ease;
}

.swipe-carousel-dot.active {
  transform: scale(1.2);
  background: var(--app-primary);
}
</style>
