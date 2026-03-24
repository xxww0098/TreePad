import { computed, ref, type Ref } from 'vue'

export interface AttachedFile {
  path: string
  name: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachedFiles?: AttachedFile[]
  attachedFolders?: AttachedFile[]
  attachedFilesContext?: string
}

export interface HistorySession {
  id: string
  title: string
  preview: string
  messages: ChatMessage[]
  createdAt: number
}

interface UseConversationHistoryOptions {
  messages: Ref<ChatMessage[]>
  t: (key: 'treepad.history.untitled' | 'treepad.history.empty') => string
}

export function cloneAttachedFiles(files: AttachedFile[]): AttachedFile[] {
  return files.map((file) => ({ ...file }))
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    attachedFiles: message.attachedFiles ? cloneAttachedFiles(message.attachedFiles) : undefined,
    attachedFolders: message.attachedFolders ? cloneAttachedFiles(message.attachedFolders) : undefined,
  }
}

export function useConversationHistory(options: UseConversationHistoryOptions) {
  const conversationHistory = ref<HistorySession[]>([])
  const lastUserMessage = ref<ChatMessage | null>(null)
  const canOpenHistory = computed(() => conversationHistory.value.length > 0)

  function syncLastUserMessage() {
    lastUserMessage.value = [...options.messages.value].reverse().find((message) => message.role === 'user') ?? null
  }

  function setLastUserMessage(message: ChatMessage | null) {
    lastUserMessage.value = message
  }

  function clearLastUserMessage() {
    lastUserMessage.value = null
  }

  function archiveCurrentConversation() {
    const sessionMessages = options.messages.value.filter((message) => message.content.trim() || message.attachedFiles?.length)
    if (!sessionMessages.length) return

    const firstUserMessage = sessionMessages.find((message) => message.role === 'user')
    const latestMessage = [...sessionMessages].reverse().find((message) => message.content.trim())
    const titleSource = firstUserMessage?.content || latestMessage?.content || options.t('treepad.history.untitled')
    const previewSource = latestMessage?.content || options.t('treepad.history.empty')

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

  function restoreHistorySession(sessionId: string): HistorySession | null {
    const session = conversationHistory.value.find((item) => item.id === sessionId)
    if (!session) return null

    options.messages.value = session.messages.map(cloneChatMessage)
    syncLastUserMessage()
    return session
  }

  return {
    archiveCurrentConversation,
    canOpenHistory,
    clearLastUserMessage,
    cloneAttachedFiles,
    conversationHistory,
    lastUserMessage,
    restoreHistorySession,
    setLastUserMessage,
    syncLastUserMessage,
  }
}
