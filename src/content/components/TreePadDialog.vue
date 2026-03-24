<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useTheme } from '../composables/useTheme'
import {
  useConversationHistory,
  type AttachedFile,
  type ChatMessage,
} from '../composables/useConversationHistory'
import { useChatSession } from '../composables/useChatSession'
import { useDialogGeometry } from '../composables/useDialogGeometry'
import { useI18n } from '../composables/useI18n'
import { useTreeStore } from '../stores/tree'
import type { AIChatMessage } from '../../shared/types'
import MessageList from './MessageList.vue'
import TreePadActionDock from './TreePadActionDock.vue'
import TreePadComposer from './TreePadComposer.vue'
import TreePadQuickActions from './TreePadQuickActions.vue'
import {
  buildAttachedFilesContext as buildAttachedFilesContextContent,
  fetchAttachedFileContentViaBackground,
} from '../utils/attached-context'

const props = defineProps<{
  revealSignal: number
}>()

const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const store = useTreeStore()
const { t } = useI18n()
const { isDark } = useTheme()

interface QuickAction {
  key: 'purpose' | 'logic' | 'review'
  label: string
  title: string
  description: string
  hint: string
  prompt: string
  iconPaths: string[]
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const actionDockEl = ref<HTMLElement | null>(null)
const minimized = ref(false)
const historyOpen = ref(false)

// ── Multi-file attachment ────────────────────────────────────
const attachedFiles = ref<AttachedFile[]>([])
const attachedFolders = ref<AttachedFile[]>([])

const composerRef = ref<InstanceType<typeof TreePadComposer> | null>(null)

const quickActions = computed<QuickAction[]>(() => [
  {
    key: 'purpose',
    label: t.value('treepad.quick.label1'),
    title: t.value('treepad.quick.tip1'),
    description: t.value('treepad.quick.desc1'),
    hint: t.value('treepad.quick.hint1'),
    prompt: t.value('treepad.quick.prompt1'),
    iconPaths: [
      'M6.5 2a4.5 4.5 0 1 0 2.79 8.03l2.34 2.34a.75.75 0 1 0 1.06-1.06l-2.34-2.34A4.5 4.5 0 0 0 6.5 2Zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
    ],
  },
  {
    key: 'logic',
    label: t.value('treepad.quick.label2'),
    title: t.value('treepad.quick.tip2'),
    description: t.value('treepad.quick.desc2'),
    hint: t.value('treepad.quick.hint2'),
    prompt: t.value('treepad.quick.prompt2'),
    iconPaths: [
      'M3 1.75C3 .784 3.784 0 4.75 0h4.69c.464 0 .909.184 1.237.513l1.81 1.81c.329.328.513.773.513 1.237v8.69A1.75 1.75 0 0 1 11.25 14h-6.5A1.75 1.75 0 0 1 3 12.25V1.75Zm1.5.25v10.25c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V4.5H9.75A1.75 1.75 0 0 1 8 2.75V1.5H4.75a.25.25 0 0 0-.25.25Zm5 0v.75c0 .138.112.25.25.25h.75L9.5 2Z',
      'M5.5 6.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Zm0 2.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5.5 9Zm0 2.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
    ],
  },
  {
    key: 'review',
    label: t.value('treepad.quick.label3'),
    title: t.value('treepad.quick.tip3'),
    description: t.value('treepad.quick.desc3'),
    hint: t.value('treepad.quick.hint3'),
    prompt: t.value('treepad.quick.prompt3'),
    iconPaths: [
      'M8 0c.176 0 .351.031.516.092l4.75 1.75A.75.75 0 0 1 13.75 2.55v3.467c0 3.104-1.826 5.973-4.664 7.355a.75.75 0 0 1-.652 0C5.576 11.99 3.75 9.121 3.75 6.017V2.55a.75.75 0 0 1 .484-.708l4.75-1.75A1.5 1.5 0 0 1 8 0Zm0 1.594L5.25 2.606v3.411c0 2.426 1.355 4.68 3.5 5.877 2.145-1.197 3.5-3.45 3.5-5.877V2.606L8 1.594Z',
      'M7.25 4.75a.875.875 0 1 1 1.75 0 .875.875 0 0 1-1.75 0Zm0 3a.75.75 0 0 1 1.5 0v1.75a.75.75 0 0 1-1.5 0V7.75Z',
    ],
  },
])

let blurMinimizeTimer: number | null = null

const {
  dialogStyle,
  interactionActive: isDialogInteracting,
  isPositioned,
  onHeaderPointerDown,
  onResizePointerDown,
  onWindowResize,
  outsideActionDockStyle,
  outsideDockStyle,
  resetSizeAndPosition,
  syncDialogBounds,
} = useDialogGeometry({
  dialogEl,
  initialWidth: settings.treepadW,
  initialHeight: settings.treepadH,
  onPersistSize: (width, height) => {
    settings.treepadW = width
    settings.treepadH = height
  },
})

// Merge dialog style with opacity-based background
const dialogFullStyle = computed(() => {
  const alpha = (settings.panelOpacity / 100).toFixed(2)
  const bg = isDark.value
    ? `rgba(15, 18, 30, ${alpha})`
    : `rgba(245, 247, 255, ${alpha})`
  return {
    ...dialogStyle.value,
    '--rt-bg': bg,
  }
})

// Add opacity-based background to dock styles
const dialogBgStyle = computed(() => {
  const alpha = (settings.panelOpacity / 100).toFixed(2)
  return isDark.value
    ? `rgba(15, 18, 30, ${alpha})`
    : `rgba(245, 247, 255, ${alpha})`
})

const actionDockFullStyle = computed(() => ({
  ...outsideActionDockStyle.value,
}))

const emptyDockFullStyle = computed(() => ({
  ...outsideDockStyle.value,
  '--rt-bg': dialogBgStyle.value,
}))

const currentRepoAttachmentPath = computed(() => store.currentRepo?.path ?? '')
const hasDraftContent = computed(() => {
  if (input.value.trim()) return true
  return attachedFiles.value.some(file => file.path !== currentRepoAttachmentPath.value)
})
const hasConversation = computed(() => messages.value.length > 0 || hasDraftContent.value)
const {
  archiveCurrentConversation,
  canOpenHistory,
  clearLastUserMessage,
  conversationHistory,
  lastUserMessage,
  restoreHistorySession,
} = useConversationHistory({
  messages,
  t: (key) => t.value(key),
})

function clearBlurMinimizeTimer() {
  if (blurMinimizeTimer !== null) {
    window.clearTimeout(blurMinimizeTimer)
    blurMinimizeTimer = null
  }
}

function isFocusInsideDialog(): boolean {
  const nodes = [dialogEl.value, dockEl.value, actionDockEl.value].filter(Boolean) as HTMLElement[]
  if (!nodes.length) return false
  if (nodes.some(node => node.matches(':focus-within'))) return true

  const root = nodes[0].getRootNode()
  const active = root instanceof ShadowRoot
    ? root.activeElement
    : document.activeElement

  return !!active && nodes.some(node => node.contains(active))
}

// ── Auto-minimize on blur ────────────────────────────────────
function onDialogBlur(e: FocusEvent) {
  clearBlurMinimizeTimer()
  // Don't minimize during drag/resize operations
  if (isDialogInteracting.value) return
  // Don't minimize if focus moved to another element inside the dialog
  const dialog = dialogEl.value
  const dock = dockEl.value
  const actionDock = actionDockEl.value
  if (!dialog) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && (dialog.contains(related) || dock?.contains(related) || actionDock?.contains(related) || related.closest('[data-treepad-trigger="true"]') || related.closest('.treepad-panel'))) {
    return
  }
  // Don't minimize while AI is streaming
  if (loading.value) return
  blurMinimizeTimer = window.setTimeout(() => {
    blurMinimizeTimer = null
    if (isFocusInsideDialog()) return
    if (isDialogInteracting.value || loading.value) return
    minimized.value = true
  }, 120)
}

function onDialogFocusIn() {
  clearBlurMinimizeTimer()
}

// ── Focus dialog when restored from minimized ───────────────
watch(minimized, (val) => {
  if (val) {
    composerRef.value?.closeMentionPanel()
    return
  }

  nextTick(() => {
    composerRef.value?.focusInput() || dialogEl.value?.focus()
  })
})

watch(
  () => props.revealSignal,
  () => {
    clearBlurMinimizeTimer()
    minimized.value = !minimized.value
    if (!minimized.value) {
      nextTick(() => {
        composerRef.value?.focusInput() || dialogEl.value?.focus()
      })
    }
  },
)

// ── Lifecycle ───────────────────────────────────────────────
onMounted(() => {
  syncDialogBounds(true)
  attachedFiles.value = getDefaultAttachedFiles()
  composerRef.value?.focusInput()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  clearBlurMinimizeTimer()
  window.removeEventListener('resize', onWindowResize)
})

// ── Chat logic ──────────────────────────────────────────────
let scrollRaf = 0
function scrollToBottom() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    if (messagesEl.value) {
      const el = messagesEl.value
      // Only auto-scroll if user is within 100px of the bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        el.scrollTop = el.scrollHeight
      }
    }
  })
}

function getDefaultAttachedFiles(): AttachedFile[] {
  const repo = store.currentRepo
  if (!repo?.path) return []
  const name = repo.path.split('/').pop() || repo.path
  return [{ path: repo.path, name }]
}

function resetComposer() {
  input.value = ''
  error.value = ''
  composerRef.value?.closeMentionPanel()
  attachedFiles.value = getDefaultAttachedFiles()
}

async function buildAttachedFilesContext(files: AttachedFile[], folders: AttachedFile[]): Promise<string> {
  const repo = store.currentRepo
  return buildAttachedFilesContextContent({
    repo,
    allNodes: store.nodes,
    files,
    folders,
    fetchFileContent: (path) => repo
      ? fetchAttachedFileContentViaBackground(repo, path)
      : Promise.resolve(null),
  })
}

function buildAiMessagesFromHistory(): AIChatMessage[] {
  const aiMessages: AIChatMessage[] = []

  // Base identity — always present
  aiMessages.push({
    role: 'system',
    content: 'You are TreePad, a code exploration assistant. Answer questions about code clearly and concisely. Use markdown formatting in your responses (headers, lists, code blocks, bold, etc.) to make answers easy to read.',
  })

  for (const msg of messages.value) {
    if (msg.role === 'user' && msg.attachedFilesContext) {
      const fileCount = (msg.attachedFiles?.length ?? 0)
      const desc = fileCount === 1
        ? `The user attached a file to their next message.`
        : fileCount > 0
          ? `The user attached ${fileCount} files to their next message.`
          : `The user attached folder(s) containing files to their next message.`

      aiMessages.push({
        role: 'user',
        content: `${desc} Here are the file contents:\n\n${msg.attachedFilesContext}\n\nUser message:\n${msg.content}`,
      })
      continue
    }

    aiMessages.push({ role: msg.role, content: msg.content })
  }

  return aiMessages
}

const {
  error,
  loading,
  retryLast,
  send,
  stopStreaming,
  streaming,
} = useChatSession({
  messages,
  input,
  attachedFiles,
  attachedFolders,
  lastUserMessage,
  buildAttachedFilesContext,
  buildAiMessages: buildAiMessagesFromHistory,
  getBaseUrl: () => settings.aiBaseUrl || 'https://api.openai.com/v1',
  getDefaultErrorMessage: () => t.value('treepad.error'),
  getModel: () => settings.aiModel || 'gpt-4o-mini',
  closeMentionPanel: () => composerRef.value?.closeMentionPanel(),
  focusInput: () => {
    composerRef.value?.focusInput()
  },
  onBeforeSend: () => {
    historyOpen.value = false
  },
  scrollToBottom,
})

function clearMessages() {
  messages.value = []
  error.value = ''
  clearLastUserMessage()
  historyOpen.value = false
  resetComposer()
}

function startNewChat() {
  if (loading.value) return
  if (messages.value.length) {
    archiveCurrentConversation()
  }
  clearMessages()
}

function toggleHistory() {
  if (!canOpenHistory.value) return
  historyOpen.value = !historyOpen.value
}

function restoreHistory(sessionId: string) {
  const session = restoreHistorySession(sessionId)
  if (!session) return

  error.value = ''
  input.value = ''
  composerRef.value?.closeMentionPanel()
  attachedFiles.value = []
  attachedFolders.value = []
  historyOpen.value = false
  scrollToBottom()

  nextTick(() => {
    composerRef.value?.focusInput() || dialogEl.value?.focus()
  })
}

function quickPrompt(prompt: string) {
  historyOpen.value = false
  input.value = prompt
  send()
}

</script>

<template>
  <!-- Minimized pill -->
  <button
    v-if="minimized"
    type="button"
    class="treepad-pill"
    :aria-label="t('treepad.title')"
    @click="minimized = false"
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0113.25 12H9.06l-2.573 2.573A1.458 1.458 0 014 13.543V12H2.75A1.75 1.75 0 011 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h4.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H2.75z" />
    </svg>
    <span>{{ t('treepad.title') }}</span>
    <span v-if="messages.length" class="treepad-pill-badge">{{ messages.length }}</span>
    <!-- chevron up -->
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
      <path d="M3.22 10.53a.749.749 0 010-1.06l4.25-4.25a.749.749 0 011.06 0l4.25 4.25a.749.749 0 11-1.06 1.06L8 6.81 4.28 10.53a.749.749 0 01-1.06 0z" />
    </svg>
  </button>

  <!-- Full dialog -->
  <div
    v-show="!minimized"
    ref="dialogEl"
    class="treepad-dialog"
    :class="{ positioned: isPositioned }"
    :style="dialogFullStyle"
    tabindex="-1"
    @focusin="onDialogFocusIn"
    @focusout="onDialogBlur"
  >
    <!-- Resize handles -->
    <div class="treepad-resize n" @pointerdown="onResizePointerDown('n', $event)" />
    <div class="treepad-resize s" @pointerdown="onResizePointerDown('s', $event)" />
    <div class="treepad-resize e" @pointerdown="onResizePointerDown('e', $event)" />
    <div class="treepad-resize w" @pointerdown="onResizePointerDown('w', $event)" />
    <div class="treepad-resize ne" @pointerdown="onResizePointerDown('ne', $event)" />
    <div class="treepad-resize nw" @pointerdown="onResizePointerDown('nw', $event)" />
    <div class="treepad-resize se" @pointerdown="onResizePointerDown('se', $event)" />
    <div class="treepad-resize sw" @pointerdown="onResizePointerDown('sw', $event)" />

    <!-- Header (drag handle) -->
    <div class="treepad-header" @pointerdown="onHeaderPointerDown">
      <div class="treepad-header-meta">
        <span class="treepad-header-title">{{ t('treepad.title') }}</span>
        <span class="treepad-model-label">{{ settings.aiModel || 'gpt-4o-mini' }}</span>
      </div>
      <div class="treepad-header-actions">
        <!-- Stop generation -->
        <button
          v-if="streaming"
          type="button"
          class="treepad-header-stop"
          :title="t('treepad.stop')"
          :aria-label="t('treepad.stop')"
          @click.stop="stopStreaming"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3z"/>
          </svg>
        </button>
        <!-- Reset size -->
        <button
          type="button"
          class="treepad-header-reset"
          :title="t('treepad.resetSize')"
          :aria-label="t('treepad.resetSize')"
          @click="resetSizeAndPosition"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.5 3.5a.75.75 0 00-1.06 1.06L4.44 6.56a.75.75 0 001.06-1.06L3.5 3.5zM12.5 3.5a.75.75 0 011.06 1.06l-2 2a.75.75 0 01-1.06-1.06l2-2zM3.5 12.5a.75.75 0 001.06 1.06l2-2a.75.75 0 00-1.06-1.06l-2 2zM12.5 12.5a.75.75 0 01-1.06 1.06l2-2a.75.75 0 011.06 1.06l-2 2zM8 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 2zM2 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 8zM12.25 7.25a.75.75 0 010 1.5h1.5a.75.75 0 000-1.5h-1.5zM8 12.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75z"/>
          </svg>
        </button>
        <!-- Close -->
        <button
          type="button"
          class="treepad-header-close"
          :aria-label="t('treepad.close')"
          @click="emit('close')"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 111.06 1.06L9.06 8l3.22 3.22a.749.749 0 11-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 11-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesEl" class="treepad-messages">
      <MessageList
        :messages="messages"
        :loading="loading"
        :streaming="streaming"
        :error="error"
        :can-retry="!!lastUserMessage"
        @retry="retryLast"
      />
    </div>

    <TreePadComposer
      ref="composerRef"
      v-model="input"
      :loading="loading"
      :nodes="store.nodes"
      :attached-files="attachedFiles"
      :attached-folders="attachedFolders"
      @update:attached-files="attachedFiles = $event"
      @update:attached-folders="attachedFolders = $event"
      @send="send"
    />
  </div>

  <div
    v-if="!minimized"
    ref="actionDockEl"
    class="treepad-action-dock"
    :style="actionDockFullStyle"
  >
    <TreePadActionDock
      :history-open="historyOpen"
      :can-open-history="canOpenHistory"
      :has-conversation="hasConversation"
      :loading="loading"
      :conversation-history="conversationHistory"
      @new-chat="startNewChat"
      @toggle-history="toggleHistory"
      @restore-history="restoreHistory"
      @clear="clearMessages"
    />
  </div>

  <div
    v-if="!minimized && messages.length === 0 && !loading"
    ref="dockEl"
    class="treepad-empty-dock treepad-empty-dock-outside"
    :style="emptyDockFullStyle"
  >
    <TreePadQuickActions
      :actions="quickActions"
      @select-prompt="quickPrompt"
    />
  </div>
</template>
