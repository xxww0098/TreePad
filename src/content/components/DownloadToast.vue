<script setup lang="ts">
import type { DownloadProgress } from '../composables/useDownloadFolder'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

defineProps<{
  progress: DownloadProgress
}>()

const emit = defineEmits<{
  cancel: []
}>()

function statusText(p: DownloadProgress): string {
  if (p.status === 'zipping') return t.value('download.zipping')
  if (p.status === 'done') return p.errorCount > 0 ? t.value('download.doneFailed', { count: p.errorCount }) : t.value('download.done')
  if (p.status === 'cancelled') return t.value('download.cancelled')
  if (p.status === 'error') return t.value('download.error', { count: p.errorCount })
  return t.value('download.progress', { done: p.done, total: p.total })
}
</script>

<template>
  <div
    class="download-toast"
    :class="{
      'toast-done': progress.status === 'done',
      'toast-error': progress.status === 'error',
      'toast-cancelled': progress.status === 'cancelled',
    }"
  >
    <div class="toast-content">
      <span class="toast-folder">{{ progress.folderName || t('download.root') }}</span>
      <span class="toast-status">{{ statusText(progress) }}</span>
      <button
        v-if="progress.status === 'downloading'"
        class="toast-cancel"
        @click="emit('cancel')"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <span v-if="progress.status === 'done' && progress.errorCount === 0" class="toast-check">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
    <div class="toast-progress-track">
      <div
        class="toast-progress-bar"
        :class="{ error: progress.errorCount > 0 }"
        :style="{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }"
      />
    </div>
  </div>
</template>
