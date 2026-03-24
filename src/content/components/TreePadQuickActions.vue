<script setup lang="ts">
interface QuickAction {
  key: 'purpose' | 'logic' | 'review'
  label: string
  title: string
  description: string
  hint: string
  prompt: string
  iconPaths: string[]
}

defineProps<{
  actions: QuickAction[]
}>()

const emit = defineEmits<{
  selectPrompt: [prompt: string]
}>()
</script>

<template>
  <button
    v-for="action in actions"
    :key="action.key"
    type="button"
    class="treepad-quick-edge"
    :class="`tone-${action.key}`"
    :title="action.description"
    :aria-label="action.title"
    @mousedown.prevent
    @click="emit('selectPrompt', action.prompt)"
  >
    <span class="treepad-quick-edge-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
        <path
          v-for="(path, pathIndex) in action.iconPaths"
          :key="`${action.key}-${pathIndex}`"
          :d="path"
        />
      </svg>
    </span>
    <span class="treepad-quick-edge-copy">
      <span class="treepad-quick-edge-label">{{ action.label }}</span>
      <span class="treepad-quick-edge-title">{{ action.title }}</span>
    </span>
  </button>
</template>
