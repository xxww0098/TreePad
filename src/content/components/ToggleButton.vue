<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'

const settings = useSettingsStore()
const { t } = useI18n()
</script>

<template>
  <button
    class="toggle-btn"
    :class="[settings.dockSide, { 'panel-visible': settings.panelVisible }]"
    :style="settings.panelVisible && settings.dockSide === 'left' ? { left: settings.panelWidth + 'px' } : settings.panelVisible && settings.dockSide === 'right' ? { right: settings.panelWidth + 'px' } : {}"
    :title="t('toggle.title')"
    @click="settings.toggleVisible()"
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.5 0A1.5 1.5 0 005 1.5v13A1.5 1.5 0 006.5 16h5a1.5 1.5 0 001.5-1.5V13H8.75a.75.75 0 010-1.5H13V8.75H8.75a.75.75 0 010-1.5H13V4.5H8.75a.75.75 0 010-1.5H13V1.5A1.5 1.5 0 0011.5 0h-5zM3.5 3H5v1.5H3.5a1 1 0 100 2H5V8H3.5a1 1 0 100 2H5v1.5H3.5a1 1 0 100 2H5V15H3.5A2.5 2.5 0 011 12.5v-9A2.5 2.5 0 013.5 1H5v2H3.5z" />
    </svg>
  </button>
</template>
