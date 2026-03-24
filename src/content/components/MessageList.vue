<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { ChatMessage } from '../composables/useConversationHistory'
import { loadMarkdownRuntime, type MarkdownRuntimeModule } from '../runtime/loaders'

const props = defineProps<{
  messages: ChatMessage[]
  loading: boolean
  streaming: boolean
  error: string
  canRetry: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const markdownRuntime = shallowRef<MarkdownRuntimeModule | null>(null)
let markdownRuntimePromise: Promise<MarkdownRuntimeModule> | null = null
const markdownCache = new WeakMap<ChatMessage, { content: string; html: string; mode: 'fallback' | 'runtime' }>()

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function ensureMarkdownRuntime() {
  if (markdownRuntime.value || markdownRuntimePromise) return

  markdownRuntimePromise = loadMarkdownRuntime()
    .then((runtime) => {
      markdownRuntime.value = runtime
      return runtime
    })
    .finally(() => {
      markdownRuntimePromise = null
    })
}

watch(
  () => props.messages.some(message => message.role === 'assistant'),
  (hasAssistantMessages) => {
    if (hasAssistantMessages) {
      ensureMarkdownRuntime()
    }
  },
  { immediate: true },
)

function renderMarkdown(message: ChatMessage): string {
  const mode = markdownRuntime.value ? 'runtime' : 'fallback'
  const cached = markdownCache.get(message)
  if (cached && cached.content === message.content && cached.mode === mode) {
    return cached.html
  }

  if (!markdownRuntime.value) {
    ensureMarkdownRuntime()
    const html = escapeHtml(message.content).replaceAll('\n', '<br>')
    markdownCache.set(message, { content: message.content, html, mode: 'fallback' })
    return html
  }

  const html = markdownRuntime.value.renderMarkdownToSafeHtml(message.content)
  markdownCache.set(message, { content: message.content, html, mode: 'runtime' })
  return html
}
</script>

<template>
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
        <div v-if="msg.role === 'assistant'" class="treepad-md" v-html="renderMarkdown(msg)" />
        <div v-else class="treepad-bubble-text">{{ msg.content }}</div>
        <span
          v-if="streaming && i === messages.length - 1 && msg.role === 'assistant'"
          class="treepad-cursor"
          aria-hidden="true"
        />
      </div>
      <button
        v-if="msg.role === 'assistant' && canRetry && !loading"
        type="button"
        class="treepad-bubble-retry"
        :title="t('treepad.retry')"
        :aria-label="t('treepad.retry')"
        @click="emit('retry')"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.65 2.35A8.25 8.25 0 002.35 10.65a8.25 8.25 0 008.25 8.25 8.25 8.25 0 007.06-3.94l-1.47-1.47a6.25 6.25 0 01-5.59 3.41 6.25 6.25 0 010-12.5 6.25 6.25 0 014.78 1.97L13.3 5.94A8.23 8.23 0 0014 8a8.25 8.25 0 00-.35-5.65zM12 6.5v4l3-2-3-2v1.5a1 1 0 01-2 0V6.5a1 1 0 012 0z"/>
        </svg>
      </button>
    </div>
  </template>

  <div v-if="error" class="treepad-error">
    <div class="treepad-error-text">{{ error }}</div>
    <button type="button" class="treepad-error-retry" @click="emit('retry')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 2.25a5.75 5.75 0 1 0 5.4 7.71.75.75 0 1 1 1.41.5A7.25 7.25 0 1 1 12.9 3.4l.37-1.15a.75.75 0 1 1 1.43.46l-.9 2.8a.75.75 0 0 1-.95.48l-2.72-.93a.75.75 0 1 1 .48-1.42l1.22.42A5.72 5.72 0 0 0 8 2.25Z" />
      </svg>
      <span>{{ t('treepad.retry') }}</span>
    </button>
  </div>
</template>
