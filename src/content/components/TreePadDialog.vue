<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'
import { useTreeStore } from '../stores/tree'
import type { AIChatMessage } from '../../shared/types'

const props = defineProps<{
  revealSignal: number
}>()

const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const store = useTreeStore()
const { t } = useI18n()

// ── Markdown setup ──────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

// ── Chat state ──────────────────────────────────────────────
interface AttachedFile {
  path: string
  name: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachedFiles?: AttachedFile[]
  attachedFilesContext?: string
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const error = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)
const minimized = ref(false)

// ── Multi-file attachment ────────────────────────────────────
const attachedFiles = ref<AttachedFile[]>([])
const mentionPanelEl = ref<HTMLElement | null>(null)
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionActiveIndex = ref(0)
const mentionRange = ref<{ start: number; end: number } | null>(null)

const allFiles = computed(() => store.nodes.filter(node => !node.isDir))

function scoreMentionMatch(path: string, name: string, query: string): number {
  const q = query.toLowerCase()
  const lowerName = name.toLowerCase()
  const lowerPath = path.toLowerCase()

  if (lowerName === q) return 0
  if (lowerName.startsWith(q)) return 1
  if (lowerName.includes(q)) return 2
  if (lowerPath.endsWith(q)) return 3
  if (lowerPath.includes(q)) return 4
  return Number.POSITIVE_INFINITY
}

const mentionFiles = computed(() => {
  const candidates = allFiles.value.filter(node => !isFileAttached(node.path))
  const q = mentionQuery.value.trim()

  if (!q) return candidates.slice(0, 7)

  return candidates
    .map((node) => ({
      node,
      score: scoreMentionMatch(node.path, node.name, q),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.node.path.length - b.node.path.length)
    .slice(0, 7)
    .map((entry) => entry.node)
})

watch(mentionFiles, (files) => {
  if (!files.length) {
    mentionActiveIndex.value = 0
    return
  }
  if (mentionActiveIndex.value > files.length - 1) {
    mentionActiveIndex.value = files.length - 1
  }
})

function isFileAttached(path: string): boolean {
  return attachedFiles.value.some(f => f.path === path)
}

function attachFile(path: string, name: string) {
  if (!isFileAttached(path)) {
    attachedFiles.value.push({ path, name })
  }
}

function removeFile(path: string) {
  const idx = attachedFiles.value.findIndex(f => f.path === path)
  if (idx >= 0) attachedFiles.value.splice(idx, 1)
}

function closeMention() {
  mentionOpen.value = false
  mentionQuery.value = ''
  mentionActiveIndex.value = 0
  mentionRange.value = null
}

function updateMentionState() {
  const el = inputEl.value
  if (!el) {
    closeMention()
    return
  }

  const caret = el.selectionStart ?? input.value.length
  const beforeCaret = input.value.slice(0, caret)
  const mentionStart = beforeCaret.lastIndexOf('@')

  if (mentionStart < 0) {
    closeMention()
    return
  }

  const prevChar = beforeCaret[mentionStart - 1] ?? ''
  if (prevChar && /[A-Za-z0-9._%+-]/.test(prevChar)) {
    closeMention()
    return
  }

  const query = beforeCaret.slice(mentionStart + 1)
  if (/\s/.test(query)) {
    closeMention()
    return
  }

  const nextQuery = query.trimStart()
  if (mentionQuery.value !== nextQuery) {
    mentionActiveIndex.value = 0
  }

  mentionOpen.value = true
  mentionQuery.value = nextQuery
  mentionRange.value = { start: mentionStart, end: caret }
}

function syncMentionState() {
  nextTick(() => updateMentionState())
}

function onInputKeyup(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return
  syncMentionState()
}

function selectMentionFile(path: string, name: string) {
  const range = mentionRange.value
  attachFile(path, name)

  if (range) {
    const before = input.value.slice(0, range.start)
    const after = input.value.slice(range.end)
    const nextAfter = before.endsWith(' ') && after.startsWith(' ') ? after.slice(1) : after

    input.value = `${before}${nextAfter}`

    nextTick(() => {
      const el = inputEl.value
      if (!el) return
      const caret = before.length
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  closeMention()
}

function moveMention(step: number) {
  if (!mentionFiles.value.length) return
  const lastIndex = mentionFiles.value.length - 1
  const nextIndex = mentionActiveIndex.value + step
  mentionActiveIndex.value = nextIndex < 0
    ? lastIndex
    : nextIndex > lastIndex
      ? 0
      : nextIndex
}

function onDocumentMouseDown(e: MouseEvent) {
  if (!mentionOpen.value) return
  // Use composedPath() to see through Shadow DOM boundaries.
  // e.target is retargeted to the shadow host when the listener is on document,
  // so contains() checks against internal elements always fail.
  const path = e.composedPath()
  const inputNode = inputEl.value as Node | null
  const panelNode = mentionPanelEl.value as Node | null
  if ((inputNode && path.includes(inputNode)) || (panelNode && path.includes(panelNode))) return
  closeMention()
}
let blurMinimizeTimer: number | null = null

// ── Dialog geometry (draggable + resizable) ─────────────────
const VIEWPORT_MARGIN = 24
const MIN_W = 520
const MIN_H = 420
const DEFAULT_W = 680
const DEFAULT_H = 720

function getDialogMaxWidth() {
  return Math.max(320, window.innerWidth - VIEWPORT_MARGIN)
}

function getDialogMaxHeight() {
  return Math.max(320, window.innerHeight - VIEWPORT_MARGIN)
}

function getDialogMinWidth() {
  return Math.min(MIN_W, getDialogMaxWidth())
}

function getDialogMinHeight() {
  return Math.min(MIN_H, getDialogMaxHeight())
}

function getDialogDefaultWidth() {
  return Math.min(DEFAULT_W, getDialogMaxWidth())
}

function getDialogDefaultHeight() {
  return Math.min(DEFAULT_H, getDialogMaxHeight())
}

function clampDialogWidth(value: number) {
  return Math.min(getDialogMaxWidth(), Math.max(getDialogMinWidth(), Math.round(value)))
}

function clampDialogHeight(value: number) {
  return Math.min(getDialogMaxHeight(), Math.max(getDialogMinHeight(), Math.round(value)))
}

const dlgW = ref(clampDialogWidth(settings.treepadW || getDialogDefaultWidth()))
const dlgH = ref(clampDialogHeight(settings.treepadH || getDialogDefaultHeight()))
// null = use CSS default (centered bottom)
const dlgX = ref<number | null>(null)
const dlgY = ref<number | null>(null)

function persistSize() {
  settings.treepadW = clampDialogWidth(dlgW.value)
  settings.treepadH = clampDialogHeight(dlgH.value)
}

function resetSizeAndPosition() {
  dlgW.value = getDialogDefaultWidth()
  dlgH.value = getDialogDefaultHeight()
  dlgX.value = null
  dlgY.value = null
  persistSize()
}

function syncDialogBounds(shouldPersist = false) {
  const nextW = clampDialogWidth(dlgW.value || getDialogDefaultWidth())
  const nextH = clampDialogHeight(dlgH.value || getDialogDefaultHeight())
  const changed = nextW !== dlgW.value || nextH !== dlgH.value

  dlgW.value = nextW
  dlgH.value = nextH

  if (changed && shouldPersist) {
    persistSize()
  }
}

const dialogStyle = computed(() => {
  const s: Record<string, string> = {
    width: dlgW.value + 'px',
    height: dlgH.value + 'px',
  }
  if (dlgX.value !== null && dlgY.value !== null) {
    s.left = dlgX.value + 'px'
    s.top = dlgY.value + 'px'
  }
  return s
})

const isPositioned = computed(() => dlgX.value !== null)

// ── Drag to move ────────────────────────────────────────────
let dragStart: { mx: number; my: number; ox: number; oy: number } | null = null

function onHeaderPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.treepad-header-close, .treepad-header-minimize, .treepad-header-reset')) return
  e.preventDefault()

  const el = dialogEl.value!
  const rect = el.getBoundingClientRect()
  // If first drag, materialize position from current CSS layout
  if (dlgX.value === null) {
    dlgX.value = rect.left
    dlgY.value = rect.top
  }
  dragStart = { mx: e.clientX, my: e.clientY, ox: dlgX.value!, oy: dlgY.value! }
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (!dragStart) return
  dlgX.value = clampX(dragStart.ox + e.clientX - dragStart.mx)
  dlgY.value = clampY(dragStart.oy + e.clientY - dragStart.my)
}

function onDragEnd() {
  dragStart = null
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
}

// ── Drag to resize (symmetric around center) ────────────────
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
let resizeStart: { mx: number; my: number; ow: number; oh: number; cx: number; cy: number; edge: Edge; wasPositioned: boolean } | null = null

function onResizePointerDown(edge: Edge, e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()

  const el = dialogEl.value!
  const rect = el.getBoundingClientRect()
  const wasPositioned = dlgX.value !== null
  // center of the dialog
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  resizeStart = { mx: e.clientX, my: e.clientY, ow: dlgW.value, oh: dlgH.value, cx, cy, edge, wasPositioned }
  document.addEventListener('pointermove', onResizeMove)
  document.addEventListener('pointerup', onResizeEnd)
}

function onResizeMove(e: PointerEvent) {
  if (!resizeStart) return
  const dx = e.clientX - resizeStart.mx
  const dy = e.clientY - resizeStart.my
  const { ow, oh, cx, cy, edge, wasPositioned } = resizeStart

  let newW = ow, newH = oh

  // Symmetric: dragging one side expands both sides equally (2x delta)
  if (edge.includes('e')) newW = clampDialogWidth(ow + dx * 2)
  if (edge.includes('w')) newW = clampDialogWidth(ow - dx * 2)
  if (edge.includes('s')) newH = clampDialogHeight(oh + dy * 2)
  if (edge.includes('n')) newH = clampDialogHeight(oh - dy * 2)

  dlgW.value = newW
  dlgH.value = newH

  // In positioned mode, keep center fixed
  if (wasPositioned) {
    dlgX.value = clampX(cx - newW / 2)
    dlgY.value = clampY(cy - newH / 2)
  }
  // In centered mode: CSS handles horizontal centering; for vertical,
  // bottom: 0 keeps it anchored, so just changing height works.
}

function onResizeEnd() {
  resizeStart = null
  document.removeEventListener('pointermove', onResizeMove)
  document.removeEventListener('pointerup', onResizeEnd)
  persistSize()
}

function clampX(x: number) { return Math.max(0, Math.min(x, window.innerWidth - 60)) }
function clampY(y: number) { return Math.max(0, Math.min(y, window.innerHeight - 40)) }

function clearBlurMinimizeTimer() {
  if (blurMinimizeTimer !== null) {
    window.clearTimeout(blurMinimizeTimer)
    blurMinimizeTimer = null
  }
}

function isFocusInsideDialog(): boolean {
  const dialog = dialogEl.value
  if (!dialog) return false
  if (dialog.matches(':focus-within')) return true

  const root = dialog.getRootNode()
  const active = root instanceof ShadowRoot
    ? root.activeElement
    : document.activeElement

  return !!active && dialog.contains(active)
}

// ── Auto-minimize on blur ────────────────────────────────────
function onDialogBlur(e: FocusEvent) {
  clearBlurMinimizeTimer()
  // Don't minimize during drag/resize operations
  if (dragStart || resizeStart) return
  // Don't minimize if focus moved to another element inside the dialog
  const dialog = dialogEl.value
  if (!dialog) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && (dialog.contains(related) || related.closest('[data-treepad-trigger="true"]'))) {
    return
  }
  // Don't minimize while AI is streaming
  if (loading.value) return
  blurMinimizeTimer = window.setTimeout(() => {
    blurMinimizeTimer = null
    if (isFocusInsideDialog()) return
    if (dragStart || resizeStart || loading.value) return
    minimized.value = true
  }, 120)
}

function onDialogFocusIn() {
  clearBlurMinimizeTimer()
}

function onWindowResize() {
  syncDialogBounds()
}

// ── Focus dialog when restored from minimized ───────────────
watch(minimized, (val) => {
  if (val) {
    closeMention()
    return
  }

  nextTick(() => {
    inputEl.value?.focus() || dialogEl.value?.focus()
  })
})

watch(
  () => props.revealSignal,
  () => {
    clearBlurMinimizeTimer()
    minimized.value = !minimized.value
    if (!minimized.value) {
      nextTick(() => {
        inputEl.value?.focus() || dialogEl.value?.focus()
      })
    }
  },
)

// ── Lifecycle ───────────────────────────────────────────────
onMounted(() => {
  syncDialogBounds(true)
  const repo = store.currentRepo
  if (repo?.path) {
    const name = repo.path.split('/').pop() || repo.path
    attachedFiles.value = [{ path: repo.path, name }]
  }
  inputEl.value?.focus()
  document.addEventListener('mousedown', onDocumentMouseDown)
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  clearBlurMinimizeTimer()
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', onDragEnd)
  document.removeEventListener('pointermove', onResizeMove)
  document.removeEventListener('pointerup', onResizeEnd)
  document.removeEventListener('mousedown', onDocumentMouseDown)
  window.removeEventListener('resize', onWindowResize)
})

// ── Chat logic ──────────────────────────────────────────────
let scrollRaf = 0
function scrollToBottom() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

function cloneAttachedFiles(files: AttachedFile[]): AttachedFile[] {
  return files.map((file) => ({ ...file }))
}

async function buildAttachedFilesContext(files: AttachedFile[]): Promise<string> {
  const repo = store.currentRepo
  if (!repo || files.length === 0) return ''

  const fetches = files.map(async (file) => {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_RAW',
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch,
        path: file.path,
      })
      if (res.base64) {
        return { path: file.path, content: atob(res.base64) }
      }
    } catch {
      // Skip files that fail to load so the rest of the message can continue.
    }
    return null
  })

  const results = (await Promise.all(fetches)).filter(Boolean) as Array<{ path: string; content: string }>
  if (results.length === 0) return ''
  return results.map((result) => `File: ${result.path}\n\`\`\`\n${result.content}\n\`\`\``).join('\n\n')
}

function buildAiMessagesFromHistory(): AIChatMessage[] {
  const aiMessages: AIChatMessage[] = []

  for (const msg of messages.value) {
    if (msg.role === 'user' && msg.attachedFiles?.length && msg.attachedFilesContext) {
      const fileCount = msg.attachedFiles.length
      const desc = fileCount === 1
        ? `The user attached a file named "${msg.attachedFiles[0].name}" to their next message.`
        : `The user attached ${fileCount} files to their next message.`

      aiMessages.push({
        role: 'system',
        content: `${desc} Here are the file contents:\n\n${msg.attachedFilesContext}\n\nUse these files as context for that user message and relevant follow-up questions. Use markdown formatting.`,
      })
    }

    aiMessages.push({ role: msg.role, content: msg.content })
  }

  return aiMessages
}

async function send() {
  const question = input.value.trim()
  if (!question || loading.value) return

  error.value = ''
  const outgoingFiles = cloneAttachedFiles(attachedFiles.value)
  const userMessage: ChatMessage = {
    role: 'user',
    content: question,
    attachedFiles: outgoingFiles,
  }

  messages.value.push(userMessage)
  input.value = ''
  attachedFiles.value = []
  closeMention()
  loading.value = true
  scrollToBottom()

  try {
    userMessage.attachedFilesContext = await buildAttachedFilesContext(outgoingFiles)
    const aiMessages = buildAiMessagesFromHistory()

    // Push an empty assistant message that we'll stream into
    const assistantIdx = messages.value.length
    messages.value.push({ role: 'assistant', content: '' })
    scrollToBottom()

    const baseUrl = settings.aiBaseUrl || 'https://api.openai.com/v1'

    await new Promise<void>((resolve, reject) => {
      const port = chrome.runtime.connect({ name: 'ai-stream' })

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          messages.value[assistantIdx].content += msg.content
          scrollToBottom()
        } else if (msg.type === 'done') {
          port.disconnect()
          resolve()
        } else if (msg.type === 'error') {
          port.disconnect()
          // Remove the empty assistant message
          if (!messages.value[assistantIdx].content) {
            messages.value.splice(assistantIdx, 1)
          }
          reject(new Error(msg.error))
        }
      })

      port.onDisconnect.addListener(() => {
        // Port closed unexpectedly (e.g. service worker restart)
        if (loading.value) {
          resolve()
        }
      })

      port.postMessage({
        type: 'AI_CHAT_STREAM',
        baseUrl,
        model: settings.aiModel || 'gpt-4o-mini',
        messages: aiMessages,
      })
    })
  } catch (e: any) {
    error.value = e.message || t.value('treepad.error')
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (mentionOpen.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveMention(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveMention(-1)
      return
    }

    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault()
      if (mentionFiles.value.length) {
        const activeFile = mentionFiles.value[mentionActiveIndex.value] ?? mentionFiles.value[0]
        if (activeFile) {
          selectMentionFile(activeFile.path, activeFile.name)
        }
      } else {
        closeMention()
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
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
    :style="dialogStyle"
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
      <span class="treepad-header-title">{{ t('treepad.title') }}</span>
      <div class="treepad-header-actions">
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
        <!-- Minimize -->
        <button
          type="button"
          class="treepad-header-minimize"
          :title="t('treepad.minimize')"
          :aria-label="t('treepad.minimize')"
          @click="minimized = true"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 8.75a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"/>
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
      <template v-if="messages.length === 0 && !loading">
        <div class="treepad-empty">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" opacity="0.25">
            <path d="M5.433 2.304A4.494 4.494 0 003.5 6c0 1.598.564 3.05 1.47 4.114a.743.743 0 01-.089 1.04.75.75 0 01-1.041-.088A5.98 5.98 0 012.5 6c0-1.602.63-3.064 1.658-4.142a.75.75 0 011.275.446zM10.567 2.304a.75.75 0 011.275-.446A5.98 5.98 0 0113.5 6a5.98 5.98 0 01-1.34 5.066.75.75 0 01-1.041.088.743.743 0 01-.089-1.04A4.494 4.494 0 0012.5 6a4.494 4.494 0 00-1.933-3.696zM8 10.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM10.5 14a2.5 2.5 0 00-5 0 .75.75 0 01-1.5 0 4 4 0 018 0 .75.75 0 01-1.5 0z" />
          </svg>
          <span>{{ t('treepad.empty') }}</span>
        </div>
      </template>
      <template v-for="(msg, i) in messages" :key="i">
        <div class="treepad-bubble" :class="msg.role">
          <div v-if="msg.attachedFiles?.length" class="treepad-bubble-files" :class="msg.role">
            <div v-for="file in msg.attachedFiles" :key="file.path" class="treepad-bubble-file">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z" />
              </svg>
              <span class="treepad-bubble-file-name" :title="file.path">{{ file.name }}</span>
            </div>
          </div>
          <div v-if="msg.role === 'assistant'" class="treepad-md" v-html="renderMarkdown(msg.content)" />
          <div v-else class="treepad-bubble-text">{{ msg.content }}</div>
        </div>
      </template>
      <div v-if="loading && (!messages.length || messages[messages.length - 1].content === '')" class="treepad-bubble assistant">
        <div class="treepad-thinking">
          <span class="treepad-dot" />
          <span class="treepad-dot" />
          <span class="treepad-dot" />
        </div>
      </div>
      <div v-if="error" class="treepad-error">{{ error }}</div>
    </div>

    <!-- Input area -->
    <div class="treepad-input-area">
      <!-- Attached file chips -->
      <div v-if="attachedFiles.length" class="treepad-chips">
        <div v-for="file in attachedFiles" :key="file.path" class="treepad-file-chip">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z" />
          </svg>
          <span class="treepad-file-name" :title="file.path">{{ file.name }}</span>
          <button
            type="button"
            class="treepad-file-remove"
            :title="t('treepad.removeFile')"
            :aria-label="t('treepad.removeFile')"
            @mousedown.prevent
            @click="removeFile(file.path)"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 111.06 1.06L9.06 8l3.22 3.22a.749.749 0 11-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 11-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      </div>

      <div class="treepad-input-row">
        <div class="treepad-input-stack">
          <div
            v-if="mentionOpen"
            ref="mentionPanelEl"
            class="treepad-mention-panel"
            role="listbox"
            :aria-label="t('treepad.searchFiles')"
          >
            <div v-if="mentionFiles.length === 0" class="treepad-mention-empty">
              {{ t('treepad.noResults') }}
            </div>
            <button
              v-for="(node, index) in mentionFiles"
              :key="node.path"
              type="button"
              class="treepad-mention-item"
              :class="{ active: index === mentionActiveIndex }"
              @mousedown.prevent
              @click="selectMentionFile(node.path, node.name)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="treepad-mention-icon">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z" />
              </svg>
              <span class="treepad-mention-meta">
                <span class="treepad-mention-name">{{ node.name }}</span>
                <span class="treepad-mention-path">{{ node.path }}</span>
              </span>
            </button>
          </div>

          <textarea
            ref="inputEl"
            v-model="input"
            class="treepad-input"
            :placeholder="t('treepad.placeholder')"
            rows="2"
            :aria-expanded="mentionOpen"
            @input="syncMentionState"
            @click="syncMentionState"
            @keyup="onInputKeyup"
            @keydown="onKeydown"
          />
        </div>
        <button
          type="button"
          class="treepad-send"
          :aria-label="t('treepad.send')"
          :disabled="!input.trim() || loading"
          @click="send"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M.989 8 .064 2.68a1.342 1.342 0 011.85-1.462l13.402 5.744a1.13 1.13 0 010 2.076L1.913 14.782a1.343 1.343 0 01-1.85-1.463L.99 8zm1.023.258l-.863 4.803L13.89 8 1.149 2.94l.863 4.802L8.75 8 2.012 8.258z" />
          </svg>
        </button>
      </div>
      <div class="treepad-model-label">{{ settings.aiModel || 'gpt-4o-mini' }}</div>
    </div>
  </div>
</template>
