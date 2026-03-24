<script setup lang="ts">
import { useI18n } from '../composables/useI18n'

interface HistoryPanelSession {
  id: string
  title: string
  preview: string
}

defineProps<{
  sessions: HistoryPanelSession[]
}>()

const emit = defineEmits<{
  restore: [sessionId: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="treepad-history-panel">
    <div class="treepad-history-panel-title">{{ t('treepad.history.title') }}</div>
    <div v-if="sessions.length === 0" class="treepad-history-empty">
      {{ t('treepad.history.empty') }}
    </div>
    <div v-else class="treepad-history-list">
      <button
        v-for="session in sessions"
        :key="session.id"
        type="button"
        class="treepad-history-item"
        :title="t('treepad.history.restore')"
        @mousedown.prevent
        @click="emit('restore', session.id)"
      >
        <span class="treepad-history-item-title">{{ session.title || t('treepad.history.untitled') }}</span>
        <span class="treepad-history-item-preview">{{ session.preview }}</span>
      </button>
    </div>
  </div>
</template>
