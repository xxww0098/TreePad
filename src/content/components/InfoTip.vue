<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  title?: string
  text: string
}>()

const triggerEl = ref<HTMLElement | null>(null)
const bubbleEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const bubbleStyle = ref<Record<string, string>>({})
const bubbleId = `info-tip-${Math.random().toString(36).slice(2, 8)}`

function updatePosition() {
  const trigger = triggerEl.value
  const bubble = bubbleEl.value
  if (!trigger || !bubble) return

  const viewportPadding = 12
  const triggerRect = trigger.getBoundingClientRect()
  const bubbleRect = bubble.getBoundingClientRect()

  let left = triggerRect.right + 8
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - bubbleRect.width - viewportPadding),
  )

  let top = triggerRect.top - 6
  top = Math.max(
    viewportPadding,
    Math.min(top, window.innerHeight - bubbleRect.height - viewportPadding),
  )

  bubbleStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  }
}

async function showBubble() {
  visible.value = true
  await nextTick()
  updatePosition()
}

function hideBubble() {
  visible.value = false
}

function handleViewportChange() {
  if (visible.value) updatePosition()
}

onMounted(() => {
  window.addEventListener('resize', handleViewportChange)
  document.addEventListener('scroll', handleViewportChange, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportChange)
  document.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <span class="info-tip" @mouseenter="showBubble" @mouseleave="hideBubble">
    <button
      ref="triggerEl"
      type="button"
      class="info-tip-trigger"
      :aria-label="props.title || props.text"
      :aria-describedby="visible ? bubbleId : undefined"
      @focus="showBubble"
      @blur="hideBubble"
    >
      ?
    </button>
    <span
      ref="bubbleEl"
      class="info-tip-bubble"
      :class="{ 'is-visible': visible }"
      :style="bubbleStyle"
      :id="bubbleId"
      role="tooltip"
    >
      <span v-if="props.title" class="info-tip-title">{{ props.title }}</span>
      <span class="info-tip-text">{{ props.text }}</span>
    </span>
  </span>
</template>
