import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIChatMessage } from '../../shared/types'
import type { AttachedFile, ChatMessage } from './useConversationHistory'
import { useChatSession } from './useChatSession'

interface PortListenerMap {
  message: Array<(msg: any) => void>
  disconnect: Array<() => void>
}

function createPortMock() {
  const listeners: PortListenerMap = {
    message: [],
    disconnect: [],
  }

  const port = {
    onMessage: {
      addListener(listener: (msg: any) => void) {
        listeners.message.push(listener)
      },
    },
    onDisconnect: {
      addListener(listener: () => void) {
        listeners.disconnect.push(listener)
      },
    },
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      listeners.disconnect.forEach((listener) => listener())
    }),
  }

  return { listeners, port }
}

function mountUseChatSessionHarness(options?: {
  buildAttachedFilesContext?: () => Promise<string>
  buildAiMessages?: () => AIChatMessage[]
}) {
  const messages = ref<ChatMessage[]>([])
  const input = ref('Explain this flow')
  const attachedFiles = ref<AttachedFile[]>([])
  const attachedFolders = ref<AttachedFile[]>([])
  const lastUserMessage = ref<ChatMessage | null>(null)
  const scrollToBottom = vi.fn()
  const focusInput = vi.fn()
  const closeMentionPanel = vi.fn()

  const Harness = defineComponent({
    setup() {
      return useChatSession({
        messages,
        input,
        attachedFiles,
        attachedFolders,
        lastUserMessage,
        buildAttachedFilesContext: options?.buildAttachedFilesContext ?? (() => Promise.resolve('')),
        buildAiMessages: options?.buildAiMessages ?? (() => []),
        getBaseUrl: () => 'https://api.example.com/v1',
        getDefaultErrorMessage: () => 'fallback error',
        getModel: () => 'gpt-test',
        closeMentionPanel,
        focusInput,
        scrollToBottom,
      })
    },
    render() {
      return h('div')
    },
  })

  const wrapper = mount(Harness)

  return {
    wrapper,
    messages,
    input,
    scrollToBottom,
    focusInput,
    closeMentionPanel,
  }
}

describe('useChatSession', () => {
  const originalChrome = globalThis.chrome
  const originalRaf = globalThis.requestAnimationFrame
  const originalCancelRaf = globalThis.cancelAnimationFrame

  afterEach(() => {
    if (originalChrome) vi.stubGlobal('chrome', originalChrome)
    if (originalRaf) vi.stubGlobal('requestAnimationFrame', originalRaf)
    if (originalCancelRaf) vi.stubGlobal('cancelAnimationFrame', originalCancelRaf)
    vi.restoreAllMocks()
  })

  it('batches multiple stream chunks into a single animation-frame flush', async () => {
    const { listeners, port } = createPortMock()
    vi.stubGlobal('chrome', {
      runtime: {
        connect: vi.fn(() => port),
      },
    })

    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const harness = mountUseChatSessionHarness()
    const sendPromise = harness.wrapper.vm.send()

    await Promise.resolve()
    await Promise.resolve()

    expect(port.postMessage).toHaveBeenCalledTimes(1)
    expect(harness.messages.value).toHaveLength(2)
    expect(harness.messages.value[1].content).toBe('')

    listeners.message[0]({ type: 'chunk', content: 'Hello' })
    listeners.message[0]({ type: 'chunk', content: ' world' })

    expect(harness.messages.value[1].content).toBe('')
    expect(harness.scrollToBottom).toHaveBeenCalledTimes(2)

    expect(rafCallback).toBeTypeOf('function')
    const flushChunks: FrameRequestCallback = rafCallback ?? ((_: DOMHighResTimeStamp) => {
      throw new Error('Expected requestAnimationFrame callback')
    })
    flushChunks(performance.now())
    await Promise.resolve()

    expect(harness.messages.value[1].content).toBe('Hello world')
    expect(harness.scrollToBottom).toHaveBeenCalledTimes(3)

    listeners.message[0]({ type: 'done' })
    await sendPromise
  })

  it('flushes any buffered chunk before the stream completes', async () => {
    const { listeners, port } = createPortMock()
    vi.stubGlobal('chrome', {
      runtime: {
        connect: vi.fn(() => port),
      },
    })

    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const harness = mountUseChatSessionHarness()
    const sendPromise = harness.wrapper.vm.send()

    await Promise.resolve()
    await Promise.resolve()

    listeners.message[0]({ type: 'chunk', content: 'Partial answer' })
    listeners.message[0]({ type: 'done' })
    await sendPromise

    expect(harness.messages.value[1].content).toBe('Partial answer')
  })
})
