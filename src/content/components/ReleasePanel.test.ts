import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReleasePanel from './ReleasePanel.vue'

// Mock useI18n
vi.mock('../composables/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// Mock useReleases
vi.mock('../composables/useReleases', () => ({
  useReleases: () => ({
    releases: [],
    loading: false,
    loadError: null,
    hasMore: false,
    downloadProgress: null,
    selectedRelease: null,
    selectedReleaseIdx: 0,
    classifiedAssets: { matched: [], other: [], source: [] },
    showAllPlatforms: false,
    platform: 'unknown',
    fetchReleases: vi.fn(),
    downloadAsset: vi.fn(),
    selectRelease: vi.fn(),
    toggleAllPlatforms: vi.fn(),
    formatFileSize: (size: number) => `${size} B`,
    formatDate: () => '2024-01-01',
  }),
}))

describe('ReleasePanel.vue', () => {
  it('renders empty state correctly', () => {
    const wrapper = mount(ReleasePanel, {
      props: {
        repoInfo: { owner: 'test', repo: 'test', branch: 'main', path: '' },
      },
    })
    expect(wrapper.text()).toContain('release.title')
    expect(wrapper.text()).toContain('release.empty')
  })
})
