<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from '../composables/useI18n'
import { useTreeStore } from '../stores/tree'
import type { AIChatMessage, FlatNode } from '../../shared/types'

const props = defineProps<{
  revealSignal: number
}>()

const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const store = useTreeStore()
const { t } = useI18n()

// ── Markdown setup ──────────────────────────────────────────
// Use Marked class (recommended in marked v17+) with explicit options
const markdownParser = new Marked({
  gfm: true,
  breaks: true,
})

function renderMarkdown(text: string): string {
  const raw = markdownParser.parse(text) as string
  // Allow all HTML from markdown output, just sanitize potentially dangerous attributes
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] })
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
  attachedFolders?: AttachedFile[]
  attachedFilesContext?: string
}

interface QuickAction {
  key: 'purpose' | 'logic' | 'review'
  label: string
  title: string
  description: string
  hint: string
  prompt: string
  iconPaths: string[]
}

interface HistorySession {
  id: string
  title: string
  preview: string
  messages: ChatMessage[]
  createdAt: number
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const loading = ref(false)
const streaming = ref(false)
const error = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const actionDockEl = ref<HTMLElement | null>(null)
const minimized = ref(false)
const historyOpen = ref(false)
const conversationHistory = ref<HistorySession[]>([])
const viewportSize = ref({
  width: typeof window === 'undefined' ? 0 : window.innerWidth,
  height: typeof window === 'undefined' ? 0 : window.innerHeight,
})
let activePort: chrome.runtime.Port | null = null
let lastUserMessage: ChatMessage | null = null

// ── Multi-file attachment ────────────────────────────────────
const attachedFiles = ref<AttachedFile[]>([])
const attachedFolders = ref<AttachedFile[]>([])
const mentionPanelEl = ref<HTMLElement | null>(null)
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionActiveIndex = ref(0)
const mentionRange = ref<{ start: number; end: number } | null>(null)

const allFiles = computed(() => store.nodes.filter(node => !node.isDir))
const allFolders = computed(() => store.nodes.filter(node => node.isDir))

function collectSubtreeFiles(allNodes: FlatNode[], dirNode: FlatNode): FlatNode[] {
  const files: FlatNode[] = []
  for (let i = dirNode.idx + 1; i < dirNode.subtreeEnd; i++) {
    if (!allNodes[i].isDir) {
      files.push(allNodes[i])
    }
  }
  return files
}
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

const mentionItems = computed(() => {
  const q = mentionQuery.value.trim()
  const unmatchedFiles = allFiles.value.filter(node => !isFileAttached(node.path))
  const unmatchedFolders = allFolders.value

  // Combine: files first, then folders
  const all = [...unmatchedFiles, ...unmatchedFolders]

  if (!q) return all.slice(0, 10)

  return all
    .map((node) => ({
      node,
      score: scoreMentionMatch(node.path, node.name, q),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.node.path.length - b.node.path.length)
    .slice(0, 10)
    .map((entry) => entry.node)
})

watch(mentionItems, (items) => {
  if (!items.length) {
    mentionActiveIndex.value = 0
    return
  }
  if (mentionActiveIndex.value > items.length - 1) {
    mentionActiveIndex.value = items.length - 1
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

function removeFolder(path: string) {
  const idx = attachedFolders.value.findIndex(f => f.path === path)
  if (idx >= 0) attachedFolders.value.splice(idx, 1)
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
  // Don't close on space - allow typing "@src explanation" with panel open

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

function selectMentionFile(path: string, name: string, isDir = false) {
  const range = mentionRange.value
  if (isDir) {
    // Track folders separately (for display only, not attached to context)
    if (!attachedFolders.value.some(f => f.path === path)) {
      attachedFolders.value.push({ path, name })
    }
  } else {
    attachFile(path, name)
  }

  if (range) {
    const before = input.value.slice(0, range.start)
    const after = input.value.slice(range.end)
    // Insert selected path, removing @query
    input.value = `${before}${after}`

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
  if (!mentionItems.value.length) return
  const lastIndex = mentionItems.value.length - 1
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
const currentRepoAttachmentPath = computed(() => store.currentRepo?.path ?? '')
const hasDraftContent = computed(() => {
  if (input.value.trim()) return true
  return attachedFiles.value.some(file => file.path !== currentRepoAttachmentPath.value)
})
const hasConversation = computed(() => messages.value.length > 0 || hasDraftContent.value)
const canOpenHistory = computed(() => conversationHistory.value.length > 0)
const outsideQuickDockLeft = computed(() => {
  const dockWidth = 78
  const dialogLeft = dlgX.value ?? Math.round((viewportSize.value.width - dlgW.value) / 2)
  return Math.max(12, dialogLeft - dockWidth + 1)
})
const outsideActionDockLeft = computed(() => {
  const dockWidth = 92
  const dialogLeft = dlgX.value ?? Math.round((viewportSize.value.width - dlgW.value) / 2)
  const preferredLeft = dialogLeft + dlgW.value - 1
  return Math.min(preferredLeft, viewportSize.value.width - dockWidth - 12)
})
const outsideActionDockStyle = computed(() => {
  const dockHeight = 138
  const dialogTop = dlgY.value ?? Math.round(viewportSize.value.height - dlgH.value)
  const preferredTop = dialogTop + 48
  const maxTop = Math.max(16, viewportSize.value.height - dockHeight - 16)

  return {
    left: `${outsideActionDockLeft.value}px`,
    top: `${Math.min(preferredTop, maxTop)}px`,
  }
})
const outsideDockStyle = computed(() => {
  const dockHeight = 288
  const dialogTop = dlgY.value ?? Math.round(viewportSize.value.height - dlgH.value)
  const preferredTop = dialogTop + 184
  const maxTop = Math.max(16, viewportSize.value.height - dockHeight - 16)

  return {
    left: `${outsideQuickDockLeft.value}px`,
    top: `${Math.min(preferredTop, maxTop)}px`,
  }
})

// ── Drag to move ────────────────────────────────────────────
let dragStart: { mx: number; my: number; ox: number; oy: number } | null = null

function onHeaderPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.treepad-header-close, .treepad-header-minimize, .treepad-header-reset, .treepad-header-size')) return
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
  if (dragStart || resizeStart) return
  // Don't minimize if focus moved to another element inside the dialog
  const dialog = dialogEl.value
  const dock = dockEl.value
  const actionDock = actionDockEl.value
  if (!dialog) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && (dialog.contains(related) || dock?.contains(related) || actionDock?.contains(related) || related.closest('[data-treepad-trigger="true"]'))) {
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
  viewportSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
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
  attachedFiles.value = getDefaultAttachedFiles()
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
      const el = messagesEl.value
      // Only auto-scroll if user is within 100px of the bottom
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        el.scrollTop = el.scrollHeight
      }
    }
  })
}

function cloneAttachedFiles(files: AttachedFile[]): AttachedFile[] {
  return files.map((file) => ({ ...file }))
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachedFiles: message.attachedFiles ? cloneAttachedFiles(message.attachedFiles) : undefined,
    attachedFolders: message.attachedFolders ? cloneAttachedFiles(message.attachedFolders) : undefined,
  }
}

function getDefaultAttachedFiles(): AttachedFile[] {
  const repo = store.currentRepo
  if (!repo?.path) return []
  const name = repo.path.split('/').pop() || repo.path
  return [{ path: repo.path, name }]
}

function syncLastUserMessage() {
  lastUserMessage = [...messages.value].reverse().find(message => message.role === 'user') ?? null
}

function resetComposer() {
  input.value = ''
  error.value = ''
  closeMention()
  attachedFiles.value = getDefaultAttachedFiles()
}

function archiveCurrentConversation() {
  const sessionMessages = messages.value.filter(message => message.content.trim() || message.attachedFiles?.length)
  if (!sessionMessages.length) return

  const firstUserMessage = sessionMessages.find(message => message.role === 'user')
  const latestMessage = [...sessionMessages].reverse().find(message => message.content.trim())
  const titleSource = firstUserMessage?.content || latestMessage?.content || t.value('treepad.history.untitled')
  const previewSource = latestMessage?.content || t.value('treepad.history.empty')

  conversationHistory.value = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: titleSource.trim().slice(0, 28),
      preview: previewSource.trim().slice(0, 72),
      messages: sessionMessages.map(cloneChatMessage),
      createdAt: Date.now(),
    },
    ...conversationHistory.value,
  ].slice(0, 8)
}

async function buildAttachedFilesContext(files: AttachedFile[], folders: AttachedFile[]): Promise<string> {
  const repo = store.currentRepo
  if (!repo || (files.length === 0 && folders.length === 0)) return ''

  // Collect all files to fetch, including files inside folders
  const allFilesToFetch: AttachedFile[] = [...files]

  for (const folder of folders) {
    const folderNode = store.nodes.find(n => n.path === folder.path && n.isDir)
    if (folderNode) {
      const subtreeFiles = collectSubtreeFiles(store.nodes, folderNode)
      for (const fileNode of subtreeFiles) {
        allFilesToFetch.push({ path: fileNode.path, name: fileNode.name })
      }
    }
  }

  const fetches = allFilesToFetch.map(async (file) => {
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

async function send() {
  const question = input.value.trim()
  if (!question || loading.value) return

  historyOpen.value = false
  error.value = ''
  const outgoingFiles = cloneAttachedFiles(attachedFiles.value)
  const outgoingFolders = cloneAttachedFiles(attachedFolders.value)
  const userMessage: ChatMessage = {
    role: 'user',
    content: question,
    attachedFiles: outgoingFiles,
    attachedFolders: outgoingFolders,
  }

  lastUserMessage = userMessage
  messages.value.push(userMessage)
  input.value = ''
  attachedFiles.value = []
  attachedFolders.value = []
  closeMention()
  loading.value = true
  streaming.value = true
  scrollToBottom()

  try {
    userMessage.attachedFilesContext = await buildAttachedFilesContext(outgoingFiles, outgoingFolders)
    const aiMessages = buildAiMessagesFromHistory()

    // Push an empty assistant message that we'll stream into
    const assistantIdx = messages.value.length
    messages.value.push({ role: 'assistant', content: '' })
    scrollToBottom()

    const baseUrl = settings.aiBaseUrl || 'https://api.openai.com/v1'

    await new Promise<void>((resolve, reject) => {
      activePort = chrome.runtime.connect({ name: 'ai-stream' })
      const port = activePort

      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          messages.value[assistantIdx].content += msg.content
          scrollToBottom()
        } else if (msg.type === 'done') {
          port.disconnect()
          activePort = null
          resolve()
        } else if (msg.type === 'error') {
          port.disconnect()
          activePort = null
          // Remove the empty assistant message if it has no content
          if (!messages.value[assistantIdx]?.content) {
            messages.value.splice(assistantIdx, 1)
          }
          reject(new Error(msg.error))
        }
      })

      port.onDisconnect.addListener(() => {
        activePort = null
        // Port closed — streaming ended (normal or service worker restart)
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
    lastUserMessage = messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user'
      ? messages.value[messages.value.length - 1]
      : null
  } finally {
    loading.value = false
    streaming.value = false
    scrollToBottom()
  }
}

function stopStreaming() {
  if (activePort) {
    activePort.disconnect()
    activePort = null
  }
  streaming.value = false
  loading.value = false
  // Remove the partially streamed assistant message if it exists and is empty
  const last = messages.value[messages.value.length - 1]
  if (last?.role === 'assistant' && !last.content) {
    messages.value.pop()
  }
}

async function retryLast() {
  if (!lastUserMessage || loading.value) return
  const last = messages.value[messages.value.length - 1]
  if (last?.role === 'assistant') {
    messages.value.pop()
  }
  if (last?.role === 'user') {
    messages.value.pop()
  }
  // Restore the attached files
  if (lastUserMessage.attachedFiles?.length) {
    attachedFiles.value = cloneAttachedFiles(lastUserMessage.attachedFiles)
  }
  input.value = lastUserMessage.content
  await nextTick()
  inputEl.value?.focus()
}

function clearMessages() {
  messages.value = []
  error.value = ''
  lastUserMessage = null
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
  const session = conversationHistory.value.find(item => item.id === sessionId)
  if (!session) return

  messages.value = session.messages.map(cloneChatMessage)
  error.value = ''
  input.value = ''
  closeMention()
  attachedFiles.value = []
  attachedFolders.value = []
  historyOpen.value = false
  syncLastUserMessage()
  scrollToBottom()

  nextTick(() => {
    inputEl.value?.focus() || dialogEl.value?.focus()
  })
}

function quickPrompt(prompt: string) {
  historyOpen.value = false
  input.value = prompt
  send()
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

    if (e.key === 'Enter') {
      e.preventDefault()
      const items = mentionItems.value
      if (items.length > 0) {
        const idx = Math.min(mentionActiveIndex.value, items.length - 1)
        const activeItem = items[idx]
        selectMentionFile(activeItem.path, activeItem.name, activeItem.isDir)
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
      <template v-if="messages.length === 0 && !loading">
        <div class="treepad-empty">
          <div class="treepad-empty-head">
            <p class="treepad-empty-eyebrow">{{ t('treepad.empty.eyebrow') }}</p>
            <h2 class="treepad-empty-title">{{ t('treepad.empty.title') }}</h2>
            <p class="treepad-empty-subtitle">{{ t('treepad.empty.subtitle') }}</p>
          </div>
        </div>
      </template>
      <template v-for="(msg, i) in messages" :key="i">
        <div class="treepad-bubble" :class="msg.role">
          <div v-if="msg.attachedFiles?.length || msg.attachedFolders?.length" class="treepad-msg-attachments">
            <div v-for="file in msg.attachedFiles" :key="file.path" class="treepad-msg-attachment">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z" />
              </svg>
              <span class="treepad-msg-attachment-name" :title="file.path">{{ file.name }}</span>
            </div>
            <div v-for="folder in msg.attachedFolders" :key="folder.path" class="treepad-msg-attachment folder">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M1 3.25C1 2.784 1.784 2.5 2.75 2.5h10.5c.966 0 1.75.284 1.75.75v1.25a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V3.25zm0 2.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H2.75a.25.25 0 00-.25.25v1.25zM1 7.75C1 7.284 1.784 7 2.75 7h10.5c.966 0 1.75.284 1.75.75v6.5A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25v-6.5zm1.75-.25a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25H2.75z" />
              </svg>
              <span class="treepad-msg-attachment-name" :title="folder.path">{{ folder.name }}</span>
            </div>
          </div>
          <div class="treepad-bubble-content">
            <div v-if="msg.role === 'assistant'" class="treepad-md" v-html="renderMarkdown(msg.content)" />
            <div v-else class="treepad-bubble-text">{{ msg.content }}</div>
            <!-- Blinking cursor during streaming on last message -->
            <span
              v-if="streaming && i === messages.length - 1 && msg.role === 'assistant'"
              class="treepad-cursor"
              aria-hidden="true"
            />
          </div>
          <!-- Retry button on assistant messages -->
          <button
            v-if="msg.role === 'assistant' && lastUserMessage && !loading"
            type="button"
            class="treepad-bubble-retry"
            :title="t('treepad.retry')"
            :aria-label="t('treepad.retry')"
            @click="retryLast"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.65 2.35A8.25 8.25 0 002.35 10.65a8.25 8.25 0 008.25 8.25 8.25 8.25 0 007.06-3.94l-1.47-1.47a6.25 6.25 0 01-5.59 3.41 6.25 6.25 0 010-12.5 6.25 6.25 0 014.78 1.97L13.3 5.94A8.23 8.23 0 0014 8a8.25 8.25 0 00-.35-5.65zM12 6.5v4l3-2-3-2v1.5a1 1 0 01-2 0V6.5a1 1 0 012 0z"/>
            </svg>
          </button>
        </div>
      </template>
      <div v-if="error" class="treepad-error">
        <div class="treepad-error-text">{{ error }}</div>
        <button type="button" class="treepad-error-retry" @click="retryLast">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 2.25a5.75 5.75 0 1 0 5.4 7.71.75.75 0 1 1 1.41.5A7.25 7.25 0 1 1 12.9 3.4l.37-1.15a.75.75 0 1 1 1.43.46l-.9 2.8a.75.75 0 0 1-.95.48l-2.72-.93a.75.75 0 1 1 .48-1.42l1.22.42A5.72 5.72 0 0 0 8 2.25Z" />
          </svg>
          <span>{{ t('treepad.retry') }}</span>
        </button>
      </div>
    </div>

    <!-- Input area -->
    <div class="treepad-input-area">
      <!-- Attached file chips -->
      <div v-if="attachedFiles.length || attachedFolders.length" class="treepad-chips">
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
        <div v-for="folder in attachedFolders" :key="folder.path" class="treepad-file-chip folder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.25C1 2.784 1.784 2.5 2.75 2.5h10.5c.966 0 1.75.284 1.75.75v1.25a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V3.25zm0 2.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H2.75a.25.25 0 00-.25.25v1.25zM1 7.75C1 7.284 1.784 7 2.75 7h10.5c.966 0 1.75.284 1.75.75v6.5A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25v-6.5zm1.75-.25a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25H2.75z" />
          </svg>
          <span class="treepad-file-name" :title="folder.path">{{ folder.name }}</span>
          <button
            type="button"
            class="treepad-file-remove"
            :title="t('treepad.removeFile')"
            :aria-label="t('treepad.removeFile')"
            @mousedown.prevent
            @click="removeFolder(folder.path)"
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
            <div v-if="mentionItems.length === 0" class="treepad-mention-empty">
              {{ t('treepad.noResults') }}
            </div>
            <button
              v-for="(node, index) in mentionItems"
              :key="node.path"
              type="button"
              class="treepad-mention-item"
              :class="{ active: index === mentionActiveIndex, folder: node.isDir }"
              @mousedown.prevent
              @click="selectMentionFile(node.path, node.name, node.isDir)"
            >
              <svg v-if="node.isDir" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="treepad-mention-icon">
                <path d="M1 3.25C1 2.784 1.784 2.5 2.75 2.5h10.5c.966 0 1.75.284 1.75.75v1.25a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25V3.25zm0 2.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H2.75a.25.25 0 00-.25.25v1.25zM1 7.75C1 7.284 1.784 7 2.75 7h10.5c.966 0 1.75.284 1.75.75v6.5A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25v-6.5zm1.75-.25a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25H2.75z" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="treepad-mention-icon">
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75z" />
              </svg>
              <span class="treepad-mention-meta">
                <span class="treepad-mention-name">{{ node.name }}</span>
                <span class="treepad-mention-path">{{ node.path }}</span>
              </span>
              <span v-if="node.isDir" class="treepad-mention-badge">{{ t('treepad.folder') }}</span>
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
    </div>
  </div>

  <div
    v-if="!minimized"
    ref="actionDockEl"
    class="treepad-action-dock"
    :style="outsideActionDockStyle"
  >
    <button
      type="button"
      class="treepad-action-chip treepad-action-chip-new"
      :title="t('treepad.action.newChatHint')"
      :aria-label="t('treepad.action.newChat')"
      :disabled="!hasConversation || loading"
      @mousedown.prevent
      @click="startNewChat"
    >
      <span class="treepad-action-chip-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1.25a.75.75 0 0 1 .75.75v5.25H14a.75.75 0 0 1 0 1.5H8.75V14a.75.75 0 0 1-1.5 0V8.75H2a.75.75 0 0 1 0-1.5h5.25V2A.75.75 0 0 1 8 1.25Z"/>
        </svg>
      </span>
      <span class="treepad-action-chip-copy">
        <span class="treepad-action-chip-label">{{ t('treepad.action.newChat') }}</span>
        <span class="treepad-action-chip-note">{{ t('treepad.action.newChatHint') }}</span>
      </span>
    </button>

    <button
      type="button"
      class="treepad-action-chip treepad-action-chip-history"
      :class="{ active: historyOpen }"
      :title="t('treepad.action.historyHint')"
      :aria-label="t('treepad.action.history')"
      :disabled="!canOpenHistory"
      @mousedown.prevent
      @click="toggleHistory"
    >
      <span class="treepad-action-chip-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1.25a6.75 6.75 0 1 1-5.42 2.73H1.75a.75.75 0 0 1 0-1.5H4.5c.414 0 .75.336.75.75V6a.75.75 0 0 1-1.5 0V4.87A5.25 5.25 0 1 0 8 2.75a.75.75 0 0 1 0-1.5Zm-.75 3a.75.75 0 0 1 1.5 0v3.19l1.72 1.03a.75.75 0 0 1-.77 1.29L7.62 8.5a.75.75 0 0 1-.37-.64V4.25Z"/>
        </svg>
      </span>
      <span class="treepad-action-chip-copy">
        <span class="treepad-action-chip-label">{{ t('treepad.action.history') }}</span>
        <span class="treepad-action-chip-note">{{ t('treepad.action.historyHint') }}</span>
      </span>
    </button>

    <div v-if="historyOpen" class="treepad-history-panel">
      <div class="treepad-history-panel-title">{{ t('treepad.history.title') }}</div>
      <div v-if="conversationHistory.length === 0" class="treepad-history-empty">
        {{ t('treepad.history.empty') }}
      </div>
      <div v-else class="treepad-history-list">
        <button
          v-for="session in conversationHistory"
          :key="session.id"
          type="button"
          class="treepad-history-item"
          :title="t('treepad.history.restore')"
          @mousedown.prevent
          @click="restoreHistory(session.id)"
        >
          <span class="treepad-history-item-title">{{ session.title || t('treepad.history.untitled') }}</span>
          <span class="treepad-history-item-preview">{{ session.preview }}</span>
        </button>
      </div>
    </div>

    <button
      type="button"
      class="treepad-action-chip treepad-action-chip-clear"
      :title="t('treepad.action.clearHint')"
      :aria-label="t('treepad.action.clear')"
      :disabled="!hasConversation || loading"
      @mousedown.prevent
      @click="clearMessages"
    >
      <span class="treepad-action-chip-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1.5a1.75 1.75 0 0 0-1.7 1.34L4.7 3H2.75a.75.75 0 0 0 0 1.5h.44l.62 8.06A2 2 0 0 0 5.8 14.5h4.4a2 2 0 0 0 1.99-1.94l.62-8.06h.44a.75.75 0 0 0 0-1.5H11.3l-.1-.16A1.75 1.75 0 0 0 9.5 1.5h-3Zm0 1.5h3a.25.25 0 0 1 .22.13l.23.37H6.05l.23-.37A.25.25 0 0 1 6.5 3Zm-1.19 1.5h5.38l-.61 7.94a.5.5 0 0 1-.5.48H5.92a.5.5 0 0 1-.5-.48L4.81 4.5Zm1.56 1.44a.75.75 0 0 1 .75.75v3.62a.75.75 0 0 1-1.5 0V6.69a.75.75 0 0 1 .75-.75Zm2.26 0a.75.75 0 0 1 .75.75v3.62a.75.75 0 0 1-1.5 0V6.69a.75.75 0 0 1 .75-.75Z"/>
        </svg>
      </span>
      <span class="treepad-action-chip-copy">
        <span class="treepad-action-chip-label">{{ t('treepad.action.clear') }}</span>
        <span class="treepad-action-chip-note">{{ t('treepad.action.clearHint') }}</span>
      </span>
    </button>
  </div>

  <div
    v-if="!minimized && messages.length === 0 && !loading"
    ref="dockEl"
    class="treepad-empty-dock treepad-empty-dock-outside"
    :style="outsideDockStyle"
  >
    <button
      v-for="action in quickActions"
      :key="action.key"
      type="button"
      class="treepad-quick-edge"
      :class="`tone-${action.key}`"
      :title="action.description"
      :aria-label="action.title"
      @mousedown.prevent
      @click="quickPrompt(action.prompt)"
    >
      <span class="treepad-quick-edge-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path
            v-for="(path, pathIndex) in action.iconPaths"
            :key="`${action.key}-${pathIndex}`"
            :d="path"
          />
        </svg>
      </span>
      <span class="treepad-quick-edge-copy">
        <span class="treepad-quick-edge-label">{{ action.label }}</span>
        <span class="treepad-quick-edge-title">{{ action.title }}</span>
      </span>
    </button>
  </div>
</template>
