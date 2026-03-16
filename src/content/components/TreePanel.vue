<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useTheme } from '../composables/useTheme'
import { PANEL_MIN_WIDTH, PANEL_MAX_WIDTH } from '../../shared/constants'

const settings = useSettingsStore()
const { isDark } = useTheme()
const isResizing = ref(false)

const panelStyle = computed(() => {
  const alpha = (settings.panelOpacity / 100).toFixed(2)
  const bg = isDark.value
    ? `rgba(15, 18, 30, ${alpha})`
    : `rgba(245, 247, 255, ${alpha})`
  return {
    width: settings.panelWidth + 'px',
    '--rt-bg': bg,
  }
})

function startResize(e: MouseEvent) {
  isResizing.value = true
  e.preventDefault()

  const startX = e.clientX
  const startWidth = settings.panelWidth

  function onMouseMove(e: MouseEvent) {
    const diff = settings.dockSide === 'left'
      ? e.clientX - startX
      : startX - e.clientX
    settings.panelWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + diff))
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div
    class="treepad-panel"
    :class="[settings.dockSide, { hidden: !settings.panelVisible }]"
    :style="panelStyle"
  >
    <slot />
    <div
      class="resize-handle"
      :class="settings.dockSide === 'left' ? 'left' : 'right'"
      @mousedown="startResize"
    />
  </div>
</template>
