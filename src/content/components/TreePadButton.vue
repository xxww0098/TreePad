<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'

const settings = useSettingsStore()
const { t } = useI18n()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="treepad-btn"
    :class="[settings.dockSide, { 'panel-visible': settings.panelVisible }]"
    :style="settings.panelVisible && settings.dockSide === 'left' ? { left: settings.panelWidth + 'px' } : settings.panelVisible && settings.dockSide === 'right' ? { right: settings.panelWidth + 'px' } : {}"
    :title="t('treepad.button')"
    @click="$emit('click')"
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h4.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H2.75z" />
    </svg>
  </button>
</template>
