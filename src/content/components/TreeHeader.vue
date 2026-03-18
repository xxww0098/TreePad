<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useTreeStore } from '../stores/tree'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  settingsOpen: boolean
  canDownloadAll: boolean
}>()

const emit = defineEmits<{
  'toggle-settings': []
  'download-all': []
}>()

const tree = useTreeStore()
const settings = useSettingsStore()
const collapseActive = ref(false)

let collapseTimer: number | null = null

function navigateToRepo() {
  const repo = tree.currentRepo
  if (!repo) return
  const url = `/${repo.owner}/${repo.repo}`
  const Turbo = (window as any).Turbo
  if (Turbo?.visit) {
    Turbo.visit(url)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.dataset.turbo = 'true'
  document.body.appendChild(a)
  a.click()
  a.remove()
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
        <svg class="collapse-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path class="collapse-icon-rail" d="M4 3.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path class="collapse-icon-branch collapse-icon-branch-top" d="M4 4.25h6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path class="collapse-icon-branch collapse-icon-branch-mid" d="M4 8h4.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path class="collapse-icon-branch collapse-icon-branch-bottom" d="M4 11.75h5.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path class="collapse-icon-arrow-line" d="M12.4 8H8.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path class="collapse-icon-arrow-head" d="M10.35 6.35 8.35 8l2 1.65" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
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
