<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'

const settings = useSettingsStore()
const { t } = useI18n()

const token = ref('')
const hasToken = ref(false)
const aiKey = ref('')
const hasAiKey = ref(false)

onMounted(async () => {
  const [tokenRes, aiKeyRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_TOKEN' }),
    chrome.runtime.sendMessage({ type: 'GET_AI_KEY' }),
  ])
  hasToken.value = !!tokenRes.token
  hasAiKey.value = !!aiKeyRes.key
})

async function saveToken() {
  const val = token.value.trim()
  await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: val })
  hasToken.value = !!val
  token.value = ''
  if (val) window.location.reload()
}

async function removeToken() {
  await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: '' })
  hasToken.value = false
}

function onTokenKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') saveToken()
}

async function saveAiKey() {
  const val = aiKey.value.trim()
  await chrome.runtime.sendMessage({ type: 'SET_AI_KEY', key: val })
  hasAiKey.value = !!val
  aiKey.value = ''
}

async function removeAiKey() {
  await chrome.runtime.sendMessage({ type: 'SET_AI_KEY', key: '' })
  hasAiKey.value = false
}

function onAiKeyKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') saveAiKey()
}
</script>

<template>
  <div class="settings-view">
    <!-- GitHub Token -->
    <div class="settings-section">
      <div class="settings-section-title">
        <span class="settings-status" :class="hasToken ? 'on' : 'off'" />
        {{ t('settings.token.title') }}
      </div>
      <div class="settings-desc">
        {{ t('settings.token.desc') }}
      </div>
      <input
        v-model="token"
        type="password"
        class="settings-input"
        :placeholder="hasToken ? '********' : t('settings.token.placeholder')"
        autocomplete="off"
        spellcheck="false"
        @keydown="onTokenKeydown"
      >
      <div class="settings-token-actions">
        <button v-if="hasToken" class="settings-btn remove" @click="removeToken">{{ t('settings.token.remove') }}</button>
        <div style="flex:1" />
        <button class="settings-btn save" @click="saveToken">{{ t('settings.token.save') }}</button>
      </div>
      <div class="settings-hint">{{ t('settings.token.hint') }}</div>
    </div>

    <!-- AI (TreePad) -->
    <div class="settings-section">
      <div class="settings-section-title">
        <span class="settings-status" :class="hasAiKey ? 'on' : 'off'" />
        {{ t('settings.ai.title') }}
      </div>
      <div class="settings-desc">
        {{ t('settings.ai.desc') }}
      </div>

      <div class="settings-label">{{ t('settings.ai.baseUrl') }}</div>
      <input
        v-model="settings.aiBaseUrl"
        type="text"
        class="settings-input"
        :placeholder="t('settings.ai.baseUrlPlaceholder')"
        autocomplete="off"
        spellcheck="false"
      >

      <div class="settings-label" style="margin-top: 10px">{{ t('settings.ai.apiKey') }}</div>
      <input
        v-model="aiKey"
        type="password"
        class="settings-input"
        :placeholder="hasAiKey ? '********' : t('settings.ai.apiKeyPlaceholder')"
        autocomplete="off"
        spellcheck="false"
        @keydown="onAiKeyKeydown"
      >
      <div class="settings-token-actions">
        <button v-if="hasAiKey" class="settings-btn remove" @click="removeAiKey">{{ t('settings.token.remove') }}</button>
        <div style="flex:1" />
        <button class="settings-btn save" @click="saveAiKey">{{ t('settings.token.save') }}</button>
      </div>

      <div class="settings-label" style="margin-top: 10px">{{ t('settings.ai.model') }}</div>
      <input
        v-model="settings.aiModel"
        type="text"
        class="settings-input"
        :placeholder="t('settings.ai.modelPlaceholder')"
        autocomplete="off"
        spellcheck="false"
      >
      <div class="settings-hint">{{ t('settings.token.hint') }}</div>
    </div>

    <!-- Appearance -->
    <div class="settings-section">
      <div class="settings-section-title">{{ t('settings.appearance.title') }}</div>
      <div class="settings-label">{{ t('settings.appearance.position') }}</div>
      <div class="settings-segment">
        <button
          :class="{ active: settings.dockSide === 'left' }"
          @click="settings.dockSide = 'left'"
        >{{ t('settings.appearance.left') }}</button>
        <button
          :class="{ active: settings.dockSide === 'right' }"
          @click="settings.dockSide = 'right'"
        >{{ t('settings.appearance.right') }}</button>
      </div>

      <div class="settings-range-row">
        <span class="settings-label">{{ t('settings.appearance.opacity') }}</span>
        <span class="settings-range-value">{{ settings.panelOpacity }}%</span>
      </div>
      <input
        v-model.number="settings.panelOpacity"
        type="range"
        class="settings-range"
        min="30"
        max="100"
        step="1"
      >

      <div class="settings-label">{{ t('settings.appearance.language') }}</div>
      <div class="settings-segment">
        <button
          :class="{ active: settings.locale === 'zh' }"
          @click="settings.locale = 'zh'"
        >中文</button>
        <button
          :class="{ active: settings.locale === 'en' }"
          @click="settings.locale = 'en'"
        >EN</button>
      </div>
    </div>

    <!-- Fun -->
    <div class="settings-section">
      <div class="settings-section-title">{{ t('settings.fun.title') }}</div>
      <div class="settings-toggle-row">
        <span class="settings-label">{{ t('settings.fun.celebrate') }}</span>
        <button
          class="settings-toggle"
          :class="{ on: settings.celebrateStar }"
          @click="settings.celebrateStar = !settings.celebrateStar"
        >
          <span class="settings-toggle-thumb" />
        </button>
      </div>
      <div class="settings-desc">{{ t('settings.fun.celebrateDesc') }}</div>
    </div>
  </div>
</template>
