import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { PANEL_DEFAULT_WIDTH } from '../../shared/constants'

const SYNC_KEY = 'treepad_settings_sync'
const SYNC_KEYS = ['dockSide', 'panelWidth', 'celebrateStar', 'locale', 'panelOpacity', 'aiBaseUrl', 'aiModel', 'treepadW', 'treepadH']

export const useSettingsStore = defineStore('settings', () => {
  const dockSide = ref<'left' | 'right'>('left')
  const panelWidth = ref(PANEL_DEFAULT_WIDTH)
  // Keep visibility page-local so newly opened GitHub pages start collapsed.
  const panelVisible = ref(false)
  const celebrateStar = ref(true)
  const locale = ref<'en' | 'zh'>(navigator.language.startsWith('zh') ? 'zh' : 'en')
  const panelOpacity = ref(94)
  const aiBaseUrl = ref('')
  const aiModel = ref('')
  const treepadW = ref(680)
  const treepadH = ref(720)

  // Build a settings payload from current ref values
  function buildSettingsPayload() {
    return {
      dockSide: dockSide.value,
      panelWidth: panelWidth.value,
      celebrateStar: celebrateStar.value,
      locale: locale.value,
      panelOpacity: panelOpacity.value,
      aiBaseUrl: aiBaseUrl.value,
      aiModel: aiModel.value,
      treepadW: treepadW.value,
      treepadH: treepadH.value,
    }
  }

  // Load from local first, then fill gaps from sync (reinstall recovery)
  chrome.storage.local.get(SYNC_KEYS, (localData) => {
    chrome.storage.sync.get(SYNC_KEY, (syncData) => {
      const syncRecord = syncData as Record<string, Record<string, unknown> | undefined>
      const syncSettings: Record<string, unknown> = syncRecord[SYNC_KEY] ?? {}
      const local = localData as Record<string, unknown>

      if (local.dockSide === 'left' || local.dockSide === 'right') dockSide.value = local.dockSide as 'left' | 'right'
      else if (syncSettings.dockSide === 'left' || syncSettings.dockSide === 'right') dockSide.value = syncSettings.dockSide as 'left' | 'right'

      if (typeof local.panelWidth === 'number') panelWidth.value = local.panelWidth
      else if (typeof syncSettings.panelWidth === 'number') panelWidth.value = syncSettings.panelWidth

      if (typeof local.celebrateStar === 'boolean') celebrateStar.value = local.celebrateStar
      else if (typeof syncSettings.celebrateStar === 'boolean') celebrateStar.value = syncSettings.celebrateStar

      if (local.locale === 'en' || local.locale === 'zh') locale.value = local.locale as 'en' | 'zh'
      else if (syncSettings.locale === 'en' || syncSettings.locale === 'zh') locale.value = syncSettings.locale as 'en' | 'zh'

      if (typeof local.panelOpacity === 'number') panelOpacity.value = local.panelOpacity
      else if (typeof syncSettings.panelOpacity === 'number') panelOpacity.value = syncSettings.panelOpacity

      if (typeof local.aiBaseUrl === 'string') aiBaseUrl.value = local.aiBaseUrl
      else if (typeof syncSettings.aiBaseUrl === 'string') aiBaseUrl.value = syncSettings.aiBaseUrl

      if (typeof local.aiModel === 'string') aiModel.value = local.aiModel
      else if (typeof syncSettings.aiModel === 'string') aiModel.value = syncSettings.aiModel

      if (typeof local.treepadW === 'number') treepadW.value = local.treepadW
      else if (typeof syncSettings.treepadW === 'number') treepadW.value = syncSettings.treepadW

      if (typeof local.treepadH === 'number') treepadH.value = local.treepadH
      else if (typeof syncSettings.treepadH === 'number') treepadH.value = syncSettings.treepadH

      // Write sync fallback values back to local so future loads don't need sync
      chrome.storage.local.set(buildSettingsPayload())
    })
  })

  // Persist: write to both local and sync (local = primary, sync = reinstall backup)
  watch([dockSide, panelWidth, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH], () => {
    const payload = buildSettingsPayload()
    chrome.storage.local.set(payload)
    chrome.storage.sync.set({ [SYNC_KEY]: payload })  // fails silently if sync disabled or quota exceeded
  }, { immediate: false })

  function toggleSide() {
    dockSide.value = dockSide.value === 'left' ? 'right' : 'left'
  }

  function toggleVisible() {
    panelVisible.value = !panelVisible.value
  }

  return { dockSide, panelWidth, panelVisible, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH, toggleSide, toggleVisible }
})
