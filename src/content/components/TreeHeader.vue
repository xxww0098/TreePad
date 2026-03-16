<script setup lang="ts">
import { useTreeStore } from '../stores/tree'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  settingsOpen: boolean
}>()

const emit = defineEmits<{
  'toggle-settings': []
}>()

const tree = useTreeStore()
const settings = useSettingsStore()

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
</script>

<template>
  <div class="tree-header">
    <span class="tree-header-title tree-header-title-link" @click="navigateToRepo">
      {{ tree.currentRepo ? `${tree.currentRepo.owner}/${tree.currentRepo.repo}` : t('header.fallback') }}
    </span>
    <div class="tree-header-actions">
      <button
        class="tree-header-btn"
        :title="t('header.collapse')"
        @click="tree.collapseAll()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 4l5 5 5-5" />
          <path d="M3 9l5 5 5-5" />
          <line x1="1" y1="2" x2="15" y2="2" />
        </svg>
      </button>
      <button
        class="tree-header-btn"
        :class="{ 'gear-active': settingsOpen }"
        :title="t('header.settings')"
        @click="emit('toggle-settings')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        class="tree-header-btn"
        :title="t('header.close')"
        @click="settings.toggleVisible()"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  </div>
</template>
