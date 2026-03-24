import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import { configureCelebrationCanvas, useStarCelebration } from './useStarCelebration'

describe('configureCelebrationCanvas', () => {
  it('sizes the canvas in device pixels and scales the drawing context', () => {
    const scale = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      style: { cssText: '' },
      getContext: vi.fn(() => ({ scale })),
    } as unknown as HTMLCanvasElement

    configureCelebrationCanvas(canvas, 2, 1200, 800)

    expect(canvas.width).toBe(2400)
    expect(canvas.height).toBe(1600)
    expect(scale).toHaveBeenCalledWith(2, 2)
  })
})

describe('useStarCelebration', () => {
  beforeEach(() => {
    vi.resetModules()
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
    vi.restoreAllMocks()
  })

  it('adds and removes the global click listener when the setting changes', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const Harness = defineComponent({
      setup() {
        useStarCelebration()
        return () => null
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function), true)

    const settings = useSettingsStore()
    settings.celebrateStar = false
    await nextTick()

    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), true)

    settings.celebrateStar = true
    await nextTick()

    expect(addSpy).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })
})
