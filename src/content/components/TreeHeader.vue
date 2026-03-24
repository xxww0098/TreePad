<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useTreeStore } from '../stores/tree'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'
import { navigateWithTurbo } from '../utils/navigation'

const { t } = useI18n()

const props = defineProps<{
  settingsOpen: boolean
  releaseOpen: boolean
  canDownloadAll: boolean
}>()

const emit = defineEmits<{
  'toggle-settings': []
  'toggle-release': []
  'download-all': []
}>()

const tree = useTreeStore()
const settings = useSettingsStore()
const collapseActive = ref(false)

// True when any folder is expanded
const hasExpandedFolders = computed(() => tree.expandedIds.size > 0)

let collapseTimer: number | null = null

function navigateToRepo() {
  const repo = tree.currentRepo
  if (!repo) return
  navigateWithTurbo(`/${repo.owner}/${repo.repo}`)
}

function clearCollapseTimer() {
  if (collapseTimer !== null) {
    window.clearTimeout(collapseTimer)
    collapseTimer = null
  }
}

function handleCollapseAll() {
  tree.collapseAll()
  collapseActive.value = true
  clearCollapseTimer()
  collapseTimer = window.setTimeout(() => {
    collapseActive.value = false
    collapseTimer = null
  }, 260)
}

onUnmounted(() => {
  clearCollapseTimer()
})
</script>

<template>
  <div class="tree-header">
    <button
      type="button"
      class="tree-header-title tree-header-title-link"
      :aria-label="t('header.openRepo')"
      @click="navigateToRepo"
    >
      {{ tree.currentRepo ? `${tree.currentRepo.owner}/${tree.currentRepo.repo}` : t('header.fallback') }}
    </button>
    <div class="tree-header-actions">
      <button
        type="button"
        class="tree-header-btn collapse-btn"
        :class="{ 'collapse-active': collapseActive }"
        :title="t('header.collapse')"
        :aria-label="t('header.collapse')"
        @click="handleCollapseAll"
      >
        <svg
          class="collapse-icon"
          :class="{ 'chevron-down': hasExpandedFolders, 'chevron-left': !hasExpandedFolders }"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            class="collapse-chevron-path"
            d="M12.5 5 8 9.5 3.5 5"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="tree-header-btn"
        :title="t('header.downloadAll')"
        :aria-label="t('header.downloadAll')"
        :disabled="!props.canDownloadAll"
        @click="emit('download-all')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M2.75 13.5A1.25 1.25 0 0 1 1.5 12.25V10a.75.75 0 0 1 1.5 0v2.25h10V10a.75.75 0 0 1 1.5 0v2.25a1.25 1.25 0 0 1-1.25 1.25Z" />
          <path d="M7.25 2a.75.75 0 0 1 1.5 0v6.19l1.72-1.72a.75.75 0 0 1 1.06 1.06L8.53 10.56a.75.75 0 0 1-1.06 0L4.47 7.53a.75.75 0 1 1 1.06-1.06l1.72 1.72Z" />
        </svg>
      </button>
      <button
        type="button"
        class="tree-header-btn"
        :class="{ 'release-active': releaseOpen }"
        :title="t('header.releases')"
        :aria-label="t('header.releases')"
        @click="emit('toggle-release')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.752 1.752 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25zM6 5a1 1 0 110 2 1 1 0 010-2z" />
        </svg>
      </button>
      <button
        type="button"
        class="tree-header-btn"
        :class="{ 'gear-active': settingsOpen }"
        :title="t('header.settings')"
        :aria-label="t('header.settings')"
        @click="emit('toggle-settings')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        type="button"
        class="tree-header-btn"
        :title="t('header.close')"
        :aria-label="t('header.close')"
        @click="settings.toggleVisible()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  </div>
</template>
