<script setup lang="ts">
import type { HistorySession } from '../composables/useConversationHistory'
import { useI18n } from '../composables/useI18n'
import HistoryPanel from './HistoryPanel.vue'

defineProps<{
  historyOpen: boolean
  canOpenHistory: boolean
  hasConversation: boolean
  loading: boolean
  conversationHistory: HistorySession[]
}>()

const emit = defineEmits<{
  clear: []
  newChat: []
  restoreHistory: [sessionId: string]
  toggleHistory: []
}>()

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="treepad-action-chip treepad-action-chip-new"
    :title="t('treepad.action.newChatHint')"
    :aria-label="t('treepad.action.newChat')"
    :disabled="!hasConversation || loading"
    @mousedown.prevent
    @click="emit('newChat')"
  >
    <span class="treepad-action-chip-icon" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.25a.75.75 0 0 1 .75.75v5.25H14a.75.75 0 0 1 0 1.5H8.75V14a.75.75 0 0 1-1.5 0V8.75H2a.75.75 0 0 1 0-1.5h5.25V2A.75.75 0 0 1 8 1.25Z"/>
      </svg>
    </span>
    <span class="treepad-action-chip-copy">
      <span class="treepad-action-chip-label">{{ t('treepad.action.newChat') }}</span>
      <span class="treepad-action-chip-note">{{ t('treepad.action.newChatHint') }}</span>
    </span>
  </button>

  <button
    type="button"
    class="treepad-action-chip treepad-action-chip-history"
    :class="{ active: historyOpen }"
    :title="t('treepad.action.historyHint')"
    :aria-label="t('treepad.action.history')"
    :disabled="!canOpenHistory"
    @mousedown.prevent
    @click="emit('toggleHistory')"
  >
    <span class="treepad-action-chip-icon" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.25a6.75 6.75 0 1 1-5.42 2.73H1.75a.75.75 0 0 1 0-1.5H4.5c.414 0 .75.336.75.75V6a.75.75 0 0 1-1.5 0V4.87A5.25 5.25 0 1 0 8 2.75a.75.75 0 0 1 0-1.5Zm-.75 3a.75.75 0 0 1 1.5 0v3.19l1.72 1.03a.75.75 0 0 1-.77 1.29L7.62 8.5a.75.75 0 0 1-.37-.64V4.25Z"/>
      </svg>
    </span>
    <span class="treepad-action-chip-copy">
      <span class="treepad-action-chip-label">{{ t('treepad.action.history') }}</span>
      <span class="treepad-action-chip-note">{{ t('treepad.action.historyHint') }}</span>
    </span>
  </button>

  <HistoryPanel
    v-if="historyOpen"
    :sessions="conversationHistory"
    @restore="emit('restoreHistory', $event)"
  />

  <button
    type="button"
    class="treepad-action-chip treepad-action-chip-clear"
    :title="t('treepad.action.clearHint')"
    :aria-label="t('treepad.action.clear')"
    :disabled="!hasConversation || loading"
    @mousedown.prevent
    @click="emit('clear')"
  >
    <span class="treepad-action-chip-icon" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.5 1.5a1.75 1.75 0 0 0-1.7 1.34L4.7 3H2.75a.75.75 0 0 0 0 1.5h.44l.62 8.06A2 2 0 0 0 5.8 14.5h4.4a2 2 0 0 0 1.99-1.94l.62-8.06h.44a.75.75 0 0 0 0-1.5H11.3l-.1-.16A1.75 1.75 0 0 0 9.5 1.5h-3Zm0 1.5h3a.25.25 0 0 1 .22.13l.23.37H6.05l.23-.37A.25.25 0 0 1 6.5 3Zm-1.19 1.5h5.38l-.61 7.94a.5.5 0 0 1-.5.48H5.92a.5.5 0 0 1-.5-.48L4.81 4.5Zm1.56 1.44a.75.75 0 0 1 .75.75v3.62a.75.75 0 0 1-1.5 0V6.69a.75.75 0 0 1 .75-.75Zm2.26 0a.75.75 0 0 1 .75.75v3.62a.75.75 0 0 1-1.5 0V6.69a.75.75 0 0 1 .75-.75Z"/>
      </svg>
    </span>
    <span class="treepad-action-chip-copy">
      <span class="treepad-action-chip-label">{{ t('treepad.action.clear') }}</span>
      <span class="treepad-action-chip-note">{{ t('treepad.action.clearHint') }}</span>
    </span>
  </button>
</template>
