import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { PANEL_DEFAULT_WIDTH } from '../../shared/constants'

export const useSettingsStore = defineStore('settings', () => {
  const dockSide = ref<'left' | 'right'>('left')
  const panelWidth = ref(PANEL_DEFAULT_WIDTH)
  const panelVisible = ref(true)
  const celebrateStar = ref(true)
  const locale = ref<'en' | 'zh'>(navigator.language.startsWith('zh') ? 'zh' : 'en')
  const panelOpacity = ref(94)
  const aiBaseUrl = ref('')
  const aiModel = ref('')
  const treepadW = ref(460)
  const treepadH = ref(540)

  // Persist to chrome.storage.local
  chrome.storage.local.get(['dockSide', 'panelWidth', 'panelVisible', 'celebrateStar', 'locale', 'panelOpacity', 'aiBaseUrl', 'aiModel', 'treepadW', 'treepadH'], (data) => {
    if (data.dockSide === 'left' || data.dockSide === 'right') dockSide.value = data.dockSide
    if (typeof data.panelWidth === 'number') panelWidth.value = data.panelWidth
    if (typeof data.panelVisible === 'boolean') panelVisible.value = data.panelVisible
    if (typeof data.celebrateStar === 'boolean') celebrateStar.value = data.celebrateStar
    if (data.locale === 'en' || data.locale === 'zh') locale.value = data.locale
    if (typeof data.panelOpacity === 'number') panelOpacity.value = data.panelOpacity
    if (typeof data.aiBaseUrl === 'string') aiBaseUrl.value = data.aiBaseUrl
    if (typeof data.aiModel === 'string') aiModel.value = data.aiModel
    if (typeof data.treepadW === 'number') treepadW.value = data.treepadW
    if (typeof data.treepadH === 'number') treepadH.value = data.treepadH
  })

  watch([dockSide, panelWidth, panelVisible, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH], () => {
    chrome.storage.local.set({
      dockSide: dockSide.value,
      panelWidth: panelWidth.value,
      panelVisible: panelVisible.value,
      celebrateStar: celebrateStar.value,
      locale: locale.value,
      panelOpacity: panelOpacity.value,
      aiBaseUrl: aiBaseUrl.value,
      aiModel: aiModel.value,
      treepadW: treepadW.value,
      treepadH: treepadH.value,
    })
  })

  function toggleSide() {
    dockSide.value = dockSide.value === 'left' ? 'right' : 'left'
  }

  function toggleVisible() {
    panelVisible.value = !panelVisible.value
  }

  return { dockSide, panelWidth, panelVisible, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH, toggleSide, toggleVisible }
})
