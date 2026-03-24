import { nextTick, onUnmounted, ref, type Ref } from 'vue'
import type { AIChatMessage } from '../../shared/types'
import { cloneAttachedFiles, type AttachedFile, type ChatMessage } from './useConversationHistory'

interface UseChatSessionOptions {
  messages: Ref<ChatMessage[]>
  input: Ref<string>
  attachedFiles: Ref<AttachedFile[]>
  attachedFolders: Ref<AttachedFile[]>
  lastUserMessage: Ref<ChatMessage | null>
  buildAttachedFilesContext: (files: AttachedFile[], folders: AttachedFile[]) => Promise<string>
  buildAiMessages: () => AIChatMessage[]
  getBaseUrl: () => string
  getDefaultErrorMessage: () => string
  getModel: () => string
  closeMentionPanel: () => void
  focusInput: () => void
  onBeforeSend?: () => void
  scrollToBottom: () => void
}

export function useChatSession(options: UseChatSessionOptions) {
  const loading = ref(false)
  const streaming = ref(false)
  const error = ref('')

  let activePort: chrome.runtime.Port | null = null
  let chunkBuffer = ''
  let chunkFlushRaf = 0

  function cancelChunkFlush() {
    if (chunkFlushRaf) {
      cancelAnimationFrame(chunkFlushRaf)
      chunkFlushRaf = 0
    }
  }

  function flushChunkBuffer(assistantIdx: number) {
    if (!chunkBuffer) return
    const assistantMessage = options.messages.value[assistantIdx]
    if (assistantMessage?.role === 'assistant') {
      assistantMessage.content += chunkBuffer
      chunkBuffer = ''
      options.scrollToBottom()
      return
    }
    chunkBuffer = ''
  }

  function scheduleChunkFlush(assistantIdx: number) {
    if (chunkFlushRaf) return
    chunkFlushRaf = requestAnimationFrame(() => {
      chunkFlushRaf = 0
      flushChunkBuffer(assistantIdx)
    })
  }

  async function send() {
    const question = options.input.value.trim()
    if (!question || loading.value) return

    options.onBeforeSend?.()
    error.value = ''
    const outgoingFiles = cloneAttachedFiles(options.attachedFiles.value)
    const outgoingFolders = cloneAttachedFiles(options.attachedFolders.value)
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      attachedFiles: outgoingFiles,
      attachedFolders: outgoingFolders,
    }

    options.lastUserMessage.value = userMessage
    options.messages.value.push(userMessage)
    options.input.value = ''
    options.attachedFiles.value = []
    options.attachedFolders.value = []
    options.closeMentionPanel()
    loading.value = true
    streaming.value = true
    chunkBuffer = ''
    cancelChunkFlush()
    options.scrollToBottom()

    try {
      userMessage.attachedFilesContext = await options.buildAttachedFilesContext(outgoingFiles, outgoingFolders)
      const aiMessages = options.buildAiMessages()

      const assistantIdx = options.messages.value.length
      options.messages.value.push({ role: 'assistant', content: '' })
      options.scrollToBottom()

      await new Promise<void>((resolve, reject) => {
        activePort = chrome.runtime.connect({ name: 'ai-stream' })
        const port = activePort

        port.onMessage.addListener((msg) => {
          if (msg.type === 'chunk') {
            chunkBuffer += msg.content
            scheduleChunkFlush(assistantIdx)
          } else if (msg.type === 'done') {
            cancelChunkFlush()
            flushChunkBuffer(assistantIdx)
            port.disconnect()
            activePort = null
            resolve()
          } else if (msg.type === 'error') {
            cancelChunkFlush()
            flushChunkBuffer(assistantIdx)
            port.disconnect()
            activePort = null
            if (!options.messages.value[assistantIdx]?.content) {
              options.messages.value.splice(assistantIdx, 1)
            }
            reject(new Error(msg.error))
          }
        })

        port.onDisconnect.addListener(() => {
          activePort = null
          cancelChunkFlush()
          flushChunkBuffer(assistantIdx)
          if (loading.value) {
            resolve()
          }
        })

        port.postMessage({
          type: 'AI_CHAT_STREAM',
          baseUrl: options.getBaseUrl(),
          model: options.getModel(),
          messages: aiMessages,
        })
      })
    } catch (e: any) {
      error.value = e.message || options.getDefaultErrorMessage()
      options.lastUserMessage.value =
        options.messages.value.length > 0 && options.messages.value[options.messages.value.length - 1].role === 'user'
          ? options.messages.value[options.messages.value.length - 1]
          : null
    } finally {
      loading.value = false
      streaming.value = false
      options.scrollToBottom()
    }
  }

  function stopStreaming() {
    if (activePort) {
      activePort.disconnect()
      activePort = null
    }
    cancelChunkFlush()
    streaming.value = false
    loading.value = false
    const last = options.messages.value[options.messages.value.length - 1]
    if (last?.role === 'assistant' && !last.content) {
      options.messages.value.pop()
    }
  }

  async function retryLast() {
    if (!options.lastUserMessage.value || loading.value) return
    const last = options.messages.value[options.messages.value.length - 1]
    if (last?.role === 'assistant') {
      options.messages.value.pop()
    }
    if (last?.role === 'user') {
      options.messages.value.pop()
    }
    if (options.lastUserMessage.value.attachedFiles?.length) {
      options.attachedFiles.value = cloneAttachedFiles(options.lastUserMessage.value.attachedFiles)
    }
    options.input.value = options.lastUserMessage.value.content
    await nextTick()
    options.focusInput()
  }

  onUnmounted(() => {
    if (activePort) {
      activePort.disconnect()
      activePort = null
    }
    cancelChunkFlush()
    chunkBuffer = ''
  })

  return {
    error,
    loading,
    retryLast,
    send,
    stopStreaming,
    streaming,
  }
}
