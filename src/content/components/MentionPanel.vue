<script setup lang="ts">
/**
 * MentionPanel — file/folder mention autocomplete panel for TreePadDialog.
 *
 * Responsible for:
 * - Detecting `@` trigger in the input textarea
 * - Filtering the file tree for matches (by name and path)
 * - Keyboard and mouse selection of files/folders
 * - Displaying attached file chips above the input
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { FlatNode } from '../../shared/types'
import { buildMentionItems, partitionMentionNodes } from '../utils/mentions'

// ── Types ────────────────────────────────────────────────────
interface AttachedFile {
  path: string
  name: string
}

// ── Props & Emits ────────────────────────────────────────────
const props = defineProps<{
  nodes: FlatNode[]
  attachedFiles: AttachedFile[]
  attachedFolders: AttachedFile[]
  textareaEl: HTMLTextAreaElement | null
}>()

const emit = defineEmits<{
  'file-attached': [file: AttachedFile]
  'folder-attached': [folder: AttachedFile]
  'file-removed': [path: string]
  'folder-removed': [path: string]
  'text-changed': [payload: { value: string; caret: number }]
  'close': []
  'mention-query': [query: string, range: { start: number; end: number } | null]
  'mention-active': [index: number]
  'select': [path: string, name: string, isDir: boolean]
  'move-mention': [step: number]
}>()

// ── Refs ────────────────────────────────────────────────────
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const range = ref<{ start: number; end: number } | null>(null)

// ── i18n ────────────────────────────────────────────────────
const { t } = useI18n()

// ── Computed ────────────────────────────────────────────────
const nodeBuckets = computed(() => partitionMentionNodes(props.nodes))
const attachedFilePaths = computed(() => new Set(props.attachedFiles.map(file => file.path)))

const mentionItems = computed(() => {
  return buildMentionItems(
    nodeBuckets.value,
    attachedFilePaths.value,
    query.value,
  )
})

watch(mentionItems, (items) => {
  if (!items.length) {
    activeIndex.value = 0
    return
  }
  if (activeIndex.value > items.length - 1) {
    activeIndex.value = items.length - 1
  }
})

// ── Internal actions ─────────────────────────────────────────
function closePanel() {
  open.value = false
  query.value = ''
  activeIndex.value = 0
  range.value = null
  emit('close')
}

function updateState() {
  const el = props.textareaEl
  if (!el) {
    closePanel()
    return
  }

  const caret = el.selectionStart ?? el.value.length
  const beforeCaret = el.value.slice(0, caret)
  const mentionStart = beforeCaret.lastIndexOf('@')

  if (mentionStart < 0) {
    closePanel()
    return
  }

  const prevChar = beforeCaret[mentionStart - 1] ?? ''
  if (prevChar && /[A-Za-z0-9._%+-]/.test(prevChar)) {
    closePanel()
    return
  }

  const rawQuery = beforeCaret.slice(mentionStart + 1)
  const nextQuery = rawQuery.trimStart()

  if (query.value !== nextQuery) {
    activeIndex.value = 0
  }

  open.value = true
  query.value = nextQuery
  range.value = { start: mentionStart, end: caret }

  emit('mention-query', nextQuery, range.value)
}

function syncState() {
  updateState()
}

function move(step: number) {
  if (!mentionItems.value.length) return
  const lastIndex = mentionItems.value.length - 1
  const nextIndex = activeIndex.value + step
  activeIndex.value = nextIndex < 0
    ? lastIndex
    : nextIndex > lastIndex
      ? 0
      : nextIndex
  emit('mention-active', activeIndex.value)
}

// ── Public API (called by parent via template ref) ────────────
function onInputKeyup(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return
  syncState()
}

function select(path: string, name: string, isDir: boolean) {
  if (isDir) {
    const folder: AttachedFile = { path, name }
    emit('folder-attached', folder)
  } else {
    const file: AttachedFile = { path, name }
    emit('file-attached', file)
  }

  // Remove the @query token from the textarea and keep the attachment as a chip.
  const r = range.value
  const el = props.textareaEl
  if (r && el) {
    const before = el.value.slice(0, r.start)
    const after = el.value.slice(r.end)
    emit('text-changed', {
      value: `${before}${after}`,
      caret: before.length,
    })
  }

  closePanel()
  emit('select', path, name, isDir)
}

function confirmSelection() {
  const items = mentionItems.value
  if (!items.length) return
  const idx = Math.min(activeIndex.value, items.length - 1)
  const node = items[idx]
  select(node.path, node.name, node.isDir)
}

// Expose to parent via defineExpose
defineExpose({
  open,
  syncState,
  closePanel,
  move,
  select,
  confirmSelection,
  onInputKeyup,
  mentionItems,
  activeIndex,
})
</script>

<template>
  <!-- File chips — rendered above the textarea input -->
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
        @click="emit('file-removed', file.path)"
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
        @click="emit('folder-removed', folder.path)"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 111.06 1.06L9.06 8l3.22 3.22a.749.749 0 11-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 11-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Mention panel is rendered by TreePadDialog directly (for correct CSS positioning) -->
</template>
