import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { renderMarkdownToSafeHtml, loadMarkdownRuntime } = vi.hoisted(() => {
  const render = vi.fn((text: string) => `<p>${text}</p>`)
  return {
    renderMarkdownToSafeHtml: render,
    loadMarkdownRuntime: vi.fn(async () => ({
      renderMarkdownToSafeHtml: render,
    })),
  }
})

vi.mock('../runtime/loaders', () => ({
  loadMarkdownRuntime,
}))

import MessageList from './MessageList.vue'

describe('MessageList', () => {
  beforeEach(() => {
    renderMarkdownToSafeHtml.mockClear()
    loadMarkdownRuntime.mockClear()
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses cached HTML when the same assistant message rerenders unchanged', async () => {
    const pinia = createPinia()
    const messages = [{ role: 'assistant' as const, content: 'Hello TreePad' }]

    const wrapper = mount(MessageList, {
      global: {
        plugins: [pinia],
      },
      props: {
        messages,
        loading: false,
        streaming: false,
        error: '',
        canRetry: false,
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(loadMarkdownRuntime).toHaveBeenCalledTimes(1)
    expect(renderMarkdownToSafeHtml).toHaveBeenCalledTimes(1)

    renderMarkdownToSafeHtml.mockClear()

    await wrapper.setProps({ loading: true })

    expect(renderMarkdownToSafeHtml).not.toHaveBeenCalled()

    messages[0].content = 'Hello again'
    await wrapper.setProps({
      messages: [...messages],
      loading: false,
    })

    expect(renderMarkdownToSafeHtml).toHaveBeenCalledTimes(1)
  })
})
