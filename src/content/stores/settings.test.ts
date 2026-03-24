import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()

    const chromeMock = {
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
    }

    vi.stubGlobal('chrome', chromeMock)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('debounces repeated settings writes to local and sync storage', async () => {
    const { useSettingsStore } = await import('./settings')
    const store = useSettingsStore()

    await Promise.resolve()
    await Promise.resolve()

    const localSet = chrome.storage.local.set as ReturnType<typeof vi.fn>
    const syncSet = chrome.storage.sync.set as ReturnType<typeof vi.fn>
    localSet.mockClear()
    syncSet.mockClear()

    store.panelWidth = 280
    store.panelWidth = 320
    store.panelOpacity = 88

    await Promise.resolve()
    expect(localSet).not.toHaveBeenCalled()
    expect(syncSet).not.toHaveBeenCalled()

    vi.advanceTimersByTime(499)
    await Promise.resolve()
    expect(localSet).not.toHaveBeenCalled()
    expect(syncSet).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await Promise.resolve()

    expect(localSet).toHaveBeenCalledTimes(1)
    expect(syncSet).toHaveBeenCalledTimes(1)
    expect(localSet).toHaveBeenCalledWith(expect.objectContaining({
      panelWidth: 320,
      panelOpacity: 88,
    }))
    expect(syncSet).toHaveBeenCalledWith({
      treepad_settings_sync: expect.objectContaining({
        panelWidth: 320,
        panelOpacity: 88,
      }),
    })
  })
})
