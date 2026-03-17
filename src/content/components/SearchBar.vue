<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function focus() {
  inputRef.value?.focus()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('update:modelValue', '')
    inputRef.value?.blur()
  }
}

defineExpose({ focus })
</script>

<template>
  <div class="search-bar">
    <div class="search-shell">
      <span class="search-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
      </span>
      <input
        ref="inputRef"
        class="search-input"
        type="text"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.label')"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown="handleKeydown"
      >
      <span class="search-shortcut" aria-hidden="true">{{ t('search.shortcut') }}</span>
    </div>
  </div>
</template>
