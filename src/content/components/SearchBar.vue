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
    <input
      ref="inputRef"
      class="search-input"
      type="text"
      :placeholder="t('search.placeholder')"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="handleKeydown"
    />
  </div>
</template>
