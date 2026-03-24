<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { FlatNode } from '../../shared/types'
import type { AttachedFile } from '../composables/useConversationHistory'
import { useI18n } from '../composables/useI18n'
import MentionPanel from './MentionPanel.vue'

const props = defineProps<{
  modelValue: string
  loading: boolean
  nodes: FlatNode[]
  attachedFiles: AttachedFile[]
  attachedFolders: AttachedFile[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:attachedFiles': [files: AttachedFile[]]
  'update:attachedFolders': [folders: AttachedFile[]]
  send: []
}>()

const { t } = useI18n()

const inputEl = ref<HTMLTextAreaElement | null>(null)
const mentionPanelRef = ref<InstanceType<typeof MentionPanel> | null>(null)

const inputValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

function onMentionFileAttached(file: AttachedFile) {
  if (!props.attachedFiles.some((entry) => entry.path === file.path)) {
    emit('update:attachedFiles', [...props.attachedFiles, file])
  }
}

function onMentionFolderAttached(folder: AttachedFile) {
  if (!props.attachedFolders.some((entry) => entry.path === folder.path)) {
    emit('update:attachedFolders', [...props.attachedFolders, folder])
  }
}

function onMentionFileRemoved(path: string) {
  emit('update:attachedFiles', props.attachedFiles.filter((file) => file.path !== path))
}

function onMentionFolderRemoved(path: string) {
  emit('update:attachedFolders', props.attachedFolders.filter((folder) => folder.path !== path))
}

function onMentionTextChanged(payload: { value: string; caret: number }) {
  inputValue.value = payload.value
  nextTick(() => {
    const el = inputEl.value
    if (!el) return
    el.focus()
    el.setSelectionRange(payload.caret, payload.caret)
  })
}

function onKeydown(e: KeyboardEvent) {
  if (mentionPanelRef.value?.open) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionPanelRef.value.move(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionPanelRef.value.move(-1)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      mentionPanelRef.value.confirmSelection()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      mentionPanelRef.value.closePanel()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('send')
  }
}

function focusInput() {
  inputEl.value?.focus()
}

function closeMentionPanel() {
  mentionPanelRef.value?.closePanel()
}

defineExpose({
  closeMentionPanel,
  focusInput,
})
</script>

<template>
  <div class="treepad-input-area">
    <div class="treepad-input-row">
      <div class="treepad-input-stack">
        <MentionPanel
          ref="mentionPanelRef"
          :nodes="nodes"
          :attachedFiles="attachedFiles"
          :attachedFolders="attachedFolders"
          :textareaEl="inputEl"
          @file-attached="onMentionFileAttached"
          @folder-attached="onMentionFolderAttached"
          @file-removed="onMentionFileRemoved"
          @folder-removed="onMentionFolderRemoved"
          @text-changed="onMentionTextChanged"
        />

        <div
          v-if="mentionPanelRef?.open"
          class="treepad-mention-panel"
          role="listbox"
          :aria-label="t('treepad.searchFiles')"
        >
          <div v-if="mentionPanelRef?.mentionItems?.length === 0" class="treepad-mention-empty">
            {{ t('treepad.noResults') }}
          </div>
          <button
            v-for="(node, index) in mentionPanelRef?.mentionItems ?? []"
            :key="node.path"
            type="button"
            class="treepad-mention-item"
            :class="{ active: index === (mentionPanelRef?.activeIndex ?? 0), folder: node.isDir }"
            @mousedown.prevent
            @click="mentionPanelRef?.select(node.path, node.name, node.isDir)"
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
          v-model="inputValue"
          class="treepad-input"
          :placeholder="t('treepad.placeholder')"
          rows="2"
          :aria-expanded="mentionPanelRef?.open"
          @input="mentionPanelRef?.syncState()"
          @click="mentionPanelRef?.syncState()"
          @keyup="mentionPanelRef?.onInputKeyup($event)"
          @keydown="onKeydown"
        />
      </div>
      <button
        type="button"
        class="treepad-send"
        :aria-label="t('treepad.send')"
        :disabled="!modelValue.trim() || loading"
        @click="emit('send')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M.989 8 .064 2.68a1.342 1.342 0 011.85-1.462l13.402 5.744a1.13 1.13 0 010 2.076L1.913 14.782a1.343 1.343 0 01-1.85-1.463L.99 8zm1.023.258l-.863 4.803L13.89 8 1.149 2.94l.863 4.802L8.75 8 2.012 8.258z" />
        </svg>
      </button>
    </div>
  </div>
</template>
