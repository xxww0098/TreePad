import { defineStore } from 'pinia'
import { ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { PANEL_DEFAULT_WIDTH } from '../../shared/constants'

const SYNC_KEY = 'treepad_settings_sync'
const SYNC_KEYS = ['dockSide', 'panelWidth', 'celebrateStar', 'locale', 'panelOpacity', 'aiBaseUrl', 'aiModel', 'treepadW', 'treepadH']
const SETTINGS_WRITE_DEBOUNCE_MS = 500

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

  // Helper to load a setting: local takes priority over sync
  function loadSetting<T>(local: Record<string, unknown>, sync: Record<string, unknown>, key: string, validate: (v: unknown) => v is T, set: (v: T) => void): void {
    const localVal = local[key]
    if (validate(localVal)) {
      set(localVal)
      return
    }
    const syncVal = sync[key]
    if (validate(syncVal)) set(syncVal)
  }

  // Load from local first, then fill gaps from sync (reinstall recovery)
  ;(async () => {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get(SYNC_KEYS),
      chrome.storage.sync.get(SYNC_KEY),
    ])
    const syncRecord = syncData as Record<string, Record<string, unknown> | undefined>
    const syncSettings: Record<string, unknown> = syncRecord[SYNC_KEY] ?? {}
    const local = localData as Record<string, unknown>

    loadSetting(local, syncSettings, 'dockSide', (v): v is 'left' | 'right' => v === 'left' || v === 'right', (v) => dockSide.value = v)
    loadSetting(local, syncSettings, 'panelWidth', (v): v is number => typeof v === 'number', (v) => panelWidth.value = v)
    loadSetting(local, syncSettings, 'celebrateStar', (v): v is boolean => typeof v === 'boolean', (v) => celebrateStar.value = v)
    loadSetting(local, syncSettings, 'locale', (v): v is 'en' | 'zh' => v === 'en' || v === 'zh', (v) => locale.value = v)
    loadSetting(local, syncSettings, 'panelOpacity', (v): v is number => typeof v === 'number', (v) => panelOpacity.value = v)
    loadSetting(local, syncSettings, 'aiBaseUrl', (v): v is string => typeof v === 'string', (v) => aiBaseUrl.value = v)
    loadSetting(local, syncSettings, 'aiModel', (v): v is string => typeof v === 'string', (v) => aiModel.value = v)
    loadSetting(local, syncSettings, 'treepadW', (v): v is number => typeof v === 'number', (v) => treepadW.value = v)
    loadSetting(local, syncSettings, 'treepadH', (v): v is number => typeof v === 'number', (v) => treepadH.value = v)

    // Write sync fallback values back to local so future loads don't need sync
    chrome.storage.local.set(buildSettingsPayload())
  })()

  // Persist: write to both local and sync (local = primary, sync = reinstall backup)
  watchDebounced(
    [dockSide, panelWidth, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH],
    () => {
      const payload = buildSettingsPayload()
      chrome.storage.local.set(payload)
      chrome.storage.sync.set({ [SYNC_KEY]: payload })  // fails silently if sync disabled or quota exceeded
    },
    { debounce: SETTINGS_WRITE_DEBOUNCE_MS, maxWait: SETTINGS_WRITE_DEBOUNCE_MS },
  )

  function toggleSide() {
    dockSide.value = dockSide.value === 'left' ? 'right' : 'left'
  }

  function toggleVisible() {
    panelVisible.value = !panelVisible.value
  }

  return { dockSide, panelWidth, panelVisible, celebrateStar, locale, panelOpacity, aiBaseUrl, aiModel, treepadW, treepadH, toggleSide, toggleVisible }
})
