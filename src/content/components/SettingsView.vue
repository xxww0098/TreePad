<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { GitHubAuthStatus, GitHubDeviceCodeInfo } from '../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'
import InfoTip from './InfoTip.vue'
import { useTreeStore } from '../stores/tree'

const settings = useSettingsStore()
const tree = useTreeStore()
const { t } = useI18n()

const aiKey = ref('')
const hasAiKey = ref(false)
const authStatus = ref<GitHubAuthStatus | null>(null)
const authBusy = ref(false)
const authError = ref('')
const oauthFlow = ref<GitHubDeviceCodeInfo | null>(null)
const oauthMessage = ref('')
const oauthPolling = ref(false)
const showTokenGuide = ref(false)
const PANEL_OPACITY_MIN = 30
const PANEL_OPACITY_MAX = 100

let oauthPollTimer: number | null = null
let oauthPollDelayMs = 5000
let aiKeySaveTimer: number | null = null

const hasGitHubAuth = computed(() => (authStatus.value?.authMode ?? 'none') !== 'none')
const hasConfiguredOAuthClientId = computed(() => !!authStatus.value?.oauthClientId?.trim())
const preferredAccessHint = computed(() =>
  hasConfiguredOAuthClientId.value
    ? t.value('settings.oauth.ready')
    : '',
)
const tokenTemplateUrl = computed(() => {
  const params = new URLSearchParams({
    name: 'TreePad',
    description: 'Read-only access for the TreePad browser extension',
    expires_in: '30',
    contents: 'read',
    metadata: 'read',
  })
  const targetName = tree.currentRepo?.owner?.trim()
  if (targetName) params.set('target_name', targetName)
  return `https://github.com/settings/personal-access-tokens/new?${params.toString()}`
})
const currentModeHint = computed(() => {
  const status = authStatus.value
  const rate = status?.rateLimit
  if (status?.authMode === 'cookie' && rate?.detectedAsUnauthenticated) {
    return t.value('settings.github.cookieWarn')
  }
  return ''
})
const rateLimitResetHint = computed(() => {
  const resetAt = authStatus.value?.rateLimit?.resetAt
  if (!resetAt) return ''
  return t.value('settings.github.resetAt', {
    time: formatTime(resetAt),
  })
})
const githubSummaryTitle = computed(() => {
  if (authStatusClass.value === 'warn') return t.value('settings.github.summaryWarn')
  if (hasGitHubAuth.value) return t.value('settings.github.summaryOn')
  return t.value('settings.github.summaryOff')
})
const githubSummaryDescription = computed(() => {
  if (authStatusClass.value === 'warn') {
    return currentModeHint.value || t.value('settings.github.summaryWarnDesc')
  }
  if (hasGitHubAuth.value) return ''
  return t.value('settings.github.summaryOffDesc')
})
const githubResetBadgeText = computed(() => {
  if (authStatusClass.value !== 'on') return ''
  if (oauthPolling.value || authBusy.value) return ''
  return rateLimitResetHint.value
})
const githubMetaText = computed(() => {
  if (oauthPolling.value) return t.value('settings.oauth.polling')
  if (authBusy.value) return t.value('settings.github.refreshing')
  if (authStatusClass.value === 'warn' && rateLimitResetHint.value) return rateLimitResetHint.value
  if (!hasGitHubAuth.value && preferredAccessHint.value) return preferredAccessHint.value
  return ''
})
const githubActionLabel = computed(() =>
  authStatusClass.value === 'on' && hasGitHubAuth.value
    ? t.value('settings.github.manageConnection')
    : t.value('settings.github.openTokenPage'),
)
const githubActionTone = computed(() =>
  !hasGitHubAuth.value || authStatusClass.value === 'warn' ? 'save' : 'secondary',
)

const authStatusClass = computed(() => {
  if (authStatus.value?.rateLimit?.detectedAsUnauthenticated) return 'warn'
  return hasGitHubAuth.value ? 'on' : 'off'
})

const rateLimitLabel = computed(() => {
  const rate = authStatus.value?.rateLimit
  if (!rate || rate.limit === null || rate.remaining === null) {
    return t.value('settings.github.rateUnknown')
  }
  return t.value('settings.github.rateValue', {
    remaining: rate.remaining,
    limit: rate.limit,
  })
})

const rateLimitClass = computed(() => {
  const rate = authStatus.value?.rateLimit
  if (!rate || rate.remaining === null || rate.limit === null) return ''
  const ratio = rate.limit > 0 ? rate.remaining / rate.limit : 1
  if (rate.remaining === 0 || ratio <= 0.1) return 'danger'
  if (ratio <= 0.3) return 'warn'
  return 'ok'
})
const panelOpacityTrackStyle = computed(() => {
  const current = Math.min(PANEL_OPACITY_MAX, Math.max(PANEL_OPACITY_MIN, settings.panelOpacity))
  const percent = ((current - PANEL_OPACITY_MIN) / (PANEL_OPACITY_MAX - PANEL_OPACITY_MIN)) * 100
  return {
    '--panel-opacity-percent': `${percent}%`,
    background: `linear-gradient(90deg, color-mix(in srgb, var(--rt-accent) 86%, white 14%) 0%, var(--rt-accent) ${percent}%, color-mix(in srgb, var(--rt-search-border) 74%, var(--rt-panel-border)) ${percent}%, color-mix(in srgb, var(--rt-search-border) 88%, white 12%) 100%)`,
  }
})

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function clearOAuthPolling() {
  if (oauthPollTimer !== null) {
    window.clearTimeout(oauthPollTimer)
    oauthPollTimer = null
  }
}

function clearAiKeySaveTimer() {
  if (aiKeySaveTimer !== null) {
    window.clearTimeout(aiKeySaveTimer)
    aiKeySaveTimer = null
  }
}

function clampPanelOpacity(value: number): number {
  if (!Number.isFinite(value)) return settings.panelOpacity
  return Math.min(PANEL_OPACITY_MAX, Math.max(PANEL_OPACITY_MIN, Math.round(value)))
}

function setPanelOpacity(value: number) {
  settings.panelOpacity = clampPanelOpacity(value)
}

function nudgePanelOpacity(delta: number) {
  setPanelOpacity(settings.panelOpacity + delta)
}

function onPanelOpacityInput(event: Event) {
  setPanelOpacity(Number((event.target as HTMLInputElement).value))
}

function scheduleOAuthPoll(delayMs = oauthPollDelayMs) {
  clearOAuthPolling()
  oauthPollTimer = window.setTimeout(() => {
    void pollOAuthDeviceFlow()
  }, delayMs)
}

async function refreshAuthStatus(force = false) {
  authBusy.value = true
  const res = await chrome.runtime.sendMessage({
    type: 'GET_GITHUB_AUTH_STATUS',
    force,
  })
  authBusy.value = false

  if (res.error) {
    authError.value = res.error
    return
  }

  authError.value = ''
  authStatus.value = res.status
}

onMounted(async () => {
  const [statusRes, aiKeyRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_GITHUB_AUTH_STATUS', force: true }),
    chrome.runtime.sendMessage({ type: 'GET_AI_KEY' }),
  ])

  if (statusRes.error) {
    authError.value = statusRes.error
  } else {
    authError.value = ''
    authStatus.value = statusRes.status
  }

  hasAiKey.value = !!aiKeyRes.key
})

onUnmounted(() => {
  clearOAuthPolling()
  clearAiKeySaveTimer()
})

async function saveTokenValue(value: string) {
  authError.value = ''
  const val = value.trim()
  const res = await chrome.runtime.sendMessage({ type: 'SET_TOKEN', token: val })

  if (res.error) {
    authError.value = res.error
    return
  }

  oauthMessage.value = ''
  await refreshAuthStatus(true)
  if (val) window.location.reload()
}

async function saveAiKey(resetField = false) {
  clearAiKeySaveTimer()
  const val = aiKey.value.trim()
  await chrome.runtime.sendMessage({ type: 'SET_AI_KEY', key: val })
  hasAiKey.value = !!val
  if (resetField) aiKey.value = ''
}

async function removeAiKey() {
  clearAiKeySaveTimer()
  await chrome.runtime.sendMessage({ type: 'SET_AI_KEY', key: '' })
  hasAiKey.value = false
  aiKey.value = ''
}

function onAiKeyKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    void saveAiKey(true)
  }
}

function queueAiKeyAutoSave() {
  clearAiKeySaveTimer()
  if (!aiKey.value.trim()) return
  aiKeySaveTimer = window.setTimeout(() => {
    void saveAiKey()
  }, 600)
}

function flushAiKeyAutoSave() {
  if (!aiKey.value.trim()) return
  void saveAiKey(true)
}

function openTokenTemplate() {
  showTokenGuide.value = true
  window.open(tokenTemplateUrl.value, '_blank', 'noopener,noreferrer')
  oauthMessage.value = t.value('settings.github.tokenTemplateOpened')
}

function openOAuthPage() {
  if (!oauthFlow.value) return
  window.open(oauthFlow.value.verificationUri, '_blank', 'noopener,noreferrer')
}

function extractGitHubToken(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/(github_pat_[A-Za-z0-9_]+|gh[opusr]_[A-Za-z0-9_]+)/)
  return match?.[0]?.trim() || ''
}

async function pasteAndSaveToken(): Promise<'saved' | 'missing' | 'error'> {
  try {
    const token = extractGitHubToken(await navigator.clipboard.readText())
    if (!token) {
      authError.value = t.value('settings.token.clipboardEmpty')
      return 'missing'
    }
    await saveTokenValue(token)
    return authError.value ? 'error' : 'saved'
  } catch {
    authError.value = t.value('settings.token.clipboardDenied')
    return 'error'
  }
}

async function startPreferredGitHubAccess() {
  const result = await pasteAndSaveToken()
  if (result === 'saved' || result === 'error') return
  if (hasConfiguredOAuthClientId.value) {
    await startOAuthDeviceFlow()
    return
  }
  openTokenTemplate()
}

async function startOAuthDeviceFlow() {
  authError.value = ''
  oauthMessage.value = ''
  clearOAuthPolling()

  const res = await chrome.runtime.sendMessage({
    type: 'START_GITHUB_DEVICE_FLOW',
    clientId: authStatus.value?.oauthClientId?.trim(),
  })

  if (res.error) {
    authError.value = res.error
    return
  }

  oauthFlow.value = res.flow
  oauthPolling.value = true
  oauthPollDelayMs = Math.max(5, res.flow.interval || 5) * 1000
  oauthMessage.value = t.value('settings.oauth.started')
  openOAuthPage()
  scheduleOAuthPoll()
}

async function pollOAuthDeviceFlow() {
  if (!oauthFlow.value) return

  const res = await chrome.runtime.sendMessage({
    type: 'POLL_GITHUB_DEVICE_FLOW',
    clientId: authStatus.value?.oauthClientId?.trim(),
    deviceCode: oauthFlow.value.deviceCode,
  })

  if (res.error) {
    oauthPolling.value = false
    clearOAuthPolling()
    authError.value = res.error
    return
  }

  if (res.status === 'pending') {
    scheduleOAuthPoll()
    return
  }

  if (res.status === 'slow_down') {
    oauthPollDelayMs = Math.max(oauthPollDelayMs + 5000, (res.interval || 10) * 1000)
    scheduleOAuthPoll(oauthPollDelayMs)
    return
  }

  if (res.status === 'success') {
    oauthPolling.value = false
    clearOAuthPolling()
    oauthFlow.value = null
    oauthMessage.value = t.value('settings.oauth.success')
    await refreshAuthStatus(true)
    window.location.reload()
    return
  }

  oauthPolling.value = false
  clearOAuthPolling()
  authError.value = res.error || t.value('settings.oauth.failed')
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-section settings-section-github">
      <div class="settings-section-title">
        {{ t('settings.github.title') }}
        <InfoTip :title="t('settings.github.title')" :text="t('settings.github.desc')" />
      </div>

      <div class="settings-github-card" :class="`is-${authStatusClass}`">
        <div class="settings-github-card-head">
          <div class="settings-github-state">
            <span class="settings-status" :class="authStatusClass" />
            <span class="settings-github-state-title">{{ githubSummaryTitle }}</span>
            <span v-if="githubResetBadgeText" class="settings-github-reset-pill">
              {{ githubResetBadgeText }}
            </span>
          </div>
          <div v-if="githubSummaryDescription" class="settings-github-card-desc">
            {{ githubSummaryDescription }}
          </div>
        </div>

        <div class="settings-github-metrics">
          <div class="settings-github-metric">
            <span class="settings-github-metric-label">{{ t('settings.github.rateLimit') }}</span>
            <span class="settings-github-metric-value settings-github-metric-rate" :class="rateLimitClass">
              {{ rateLimitLabel }}
            </span>
          </div>
        </div>

        <div v-if="githubMetaText" class="settings-github-meta">{{ githubMetaText }}</div>

        <button
          type="button"
          class="settings-btn settings-github-action"
          :class="githubActionTone"
          :disabled="authBusy || oauthPolling"
          @click="startPreferredGitHubAccess"
        >
          {{ githubActionLabel }}
        </button>
      </div>

      <div v-if="authError" class="settings-error">{{ authError }}</div>

      <div v-if="!hasConfiguredOAuthClientId" class="settings-inline-help">
        <button
          type="button"
          class="settings-inline-link"
          @click="showTokenGuide = !showTokenGuide"
        >
          {{ showTokenGuide ? t('settings.github.hideTokenGuide') : t('settings.github.showTokenGuide') }}
        </button>
      </div>

      <div v-if="!hasConfiguredOAuthClientId && showTokenGuide" class="settings-device-flow">
        <div class="settings-desc settings-step-text">{{ t('settings.github.tokenStep1') }}</div>
        <div class="settings-desc settings-step-text">{{ t('settings.github.tokenStep2') }}</div>
        <div class="settings-desc settings-step-text">{{ t('settings.github.tokenStep3') }}</div>
      </div>

      <div v-if="oauthFlow" class="settings-device-flow">
        <div class="settings-label">{{ t('settings.oauth.userCode') }}</div>
        <div class="settings-code">{{ oauthFlow.userCode }}</div>
        <div class="settings-desc">
          {{ t('settings.oauth.instructions') }}
        </div>
        <div v-if="oauthPolling" class="settings-hint">{{ t('settings.oauth.polling') }}</div>
      </div>

      <div v-if="oauthMessage" class="settings-note">{{ oauthMessage }}</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">
        <span class="settings-status" :class="hasAiKey ? 'on' : 'off'" />
        {{ t('settings.ai.title') }}
        <InfoTip :title="t('settings.ai.title')" :text="t('settings.ai.desc')" />
      </div>

      <div class="settings-fields">
        <div class="settings-field">
          <div class="settings-label">{{ t('settings.ai.baseUrl') }}</div>
          <input
            v-model="settings.aiBaseUrl"
            type="text"
            class="settings-input"
            :placeholder="t('settings.ai.baseUrlPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          >
        </div>

        <div class="settings-field">
          <div class="settings-label">{{ t('settings.ai.apiKey') }}</div>
          <div class="settings-input-shell">
            <input
              v-model="aiKey"
              type="password"
              class="settings-input"
              :class="{ 'has-inline-action': hasAiKey }"
              :placeholder="hasAiKey ? '********' : t('settings.ai.apiKeyPlaceholder')"
              autocomplete="off"
              spellcheck="false"
              @input="queueAiKeyAutoSave"
              @blur="flushAiKeyAutoSave"
              @keydown="onAiKeyKeydown"
            >
            <button
              v-if="hasAiKey"
              type="button"
              class="settings-input-inline-remove"
              :title="t('settings.token.remove')"
              :aria-label="t('settings.token.remove')"
              @mousedown.prevent
              @click="removeAiKey"
            >
              <span class="settings-input-inline-minus" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="settings-field">
          <div class="settings-label">{{ t('settings.ai.model') }}</div>
          <input
            v-model="settings.aiModel"
            type="text"
            class="settings-input"
            :placeholder="t('settings.ai.modelPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          >
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">{{ t('settings.appearance.title') }}</div>
      <div class="settings-fields">
        <div class="settings-field">
          <div class="settings-label">{{ t('settings.appearance.position') }}</div>
          <div class="settings-segment" role="group" :aria-label="t('settings.appearance.position')">
            <button
              type="button"
              :class="{ active: settings.dockSide === 'left' }"
              :aria-pressed="settings.dockSide === 'left'"
              @click="settings.dockSide = 'left'"
            >{{ t('settings.appearance.left') }}</button>
            <button
              type="button"
              :class="{ active: settings.dockSide === 'right' }"
              :aria-pressed="settings.dockSide === 'right'"
              @click="settings.dockSide = 'right'"
            >{{ t('settings.appearance.right') }}</button>
          </div>
        </div>

        <div class="settings-field">
          <div class="settings-range-row settings-range-row--opacity">
            <div class="settings-range-copy">
              <span class="settings-label">{{ t('settings.appearance.opacity') }}</span>
              <span class="settings-hint settings-opacity-hint-inline">{{ t('settings.appearance.opacityHint') }}</span>
            </div>
            <span class="settings-range-value settings-range-value-strong">{{ settings.panelOpacity }}%</span>
          </div>
          <div class="settings-opacity-panel">
            <div class="settings-opacity-control">
              <button
                type="button"
                class="settings-opacity-stepper"
                :aria-label="t('settings.appearance.opacityDecrease')"
                :disabled="settings.panelOpacity <= PANEL_OPACITY_MIN"
                @click="nudgePanelOpacity(-1)"
              >
                -
              </button>
              <div class="settings-opacity-slider-shell">
                <input
                  :value="settings.panelOpacity"
                  type="range"
                  class="settings-range settings-range--opacity"
                  :style="panelOpacityTrackStyle"
                  :min="PANEL_OPACITY_MIN"
                  :max="PANEL_OPACITY_MAX"
                  step="1"
                  @input="onPanelOpacityInput"
                >
                <div class="settings-opacity-scale" aria-hidden="true">
                  <span>{{ PANEL_OPACITY_MIN }}%</span>
                  <span>{{ PANEL_OPACITY_MAX }}%</span>
                </div>
              </div>
              <button
                type="button"
                class="settings-opacity-stepper"
                :aria-label="t('settings.appearance.opacityIncrease')"
                :disabled="settings.panelOpacity >= PANEL_OPACITY_MAX"
                @click="nudgePanelOpacity(1)"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div class="settings-field">
          <div class="settings-label">{{ t('settings.appearance.language') }}</div>
          <div class="settings-segment" role="group" :aria-label="t('settings.appearance.language')">
            <button
              type="button"
              :class="{ active: settings.locale === 'zh' }"
              :aria-pressed="settings.locale === 'zh'"
              @click="settings.locale = 'zh'"
            >中文</button>
            <button
              type="button"
              :class="{ active: settings.locale === 'en' }"
              :aria-pressed="settings.locale === 'en'"
              @click="settings.locale = 'en'"
            >EN</button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">
        {{ t('settings.fun.title') }}
      </div>
      <div class="settings-toggle-card">
        <div class="settings-toggle-row">
          <span class="settings-label">{{ t('settings.fun.celebrate') }}</span>
          <button
            type="button"
            class="settings-toggle"
            :class="{ on: settings.celebrateStar }"
            :aria-pressed="settings.celebrateStar"
            @click="settings.celebrateStar = !settings.celebrateStar"
          >
            <span class="settings-toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
