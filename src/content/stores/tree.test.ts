import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlatNode, RepoInfo } from '../../shared/types'

const getExpandedIdsMock = vi.fn()
const setExpandedIdsMock = vi.fn()

vi.mock('../../shared/cache', () => ({
  getExpandedIds: getExpandedIdsMock,
  setExpandedIds: setExpandedIdsMock,
}))

const nodes: FlatNode[] = [
  { idx: 0, name: 'src', path: 'src', depth: 0, isDir: true, parentIdx: -1, childCount: 2, subtreeEnd: 5 },
  { idx: 1, name: 'utils', path: 'src/utils', depth: 1, isDir: true, parentIdx: 0, childCount: 2, subtreeEnd: 4 },
  { idx: 2, name: 'a.ts', path: 'src/utils/a.ts', depth: 2, isDir: false, parentIdx: 1, childCount: 0, subtreeEnd: 3 },
  { idx: 3, name: 'b.ts', path: 'src/utils/b.ts', depth: 2, isDir: false, parentIdx: 1, childCount: 0, subtreeEnd: 4 },
  { idx: 4, name: 'index.ts', path: 'src/index.ts', depth: 1, isDir: false, parentIdx: 0, childCount: 0, subtreeEnd: 5 },
  { idx: 5, name: 'README.md', path: 'README.md', depth: 0, isDir: false, parentIdx: -1, childCount: 0, subtreeEnd: 6 },
]

const repo: RepoInfo = {
  owner: 'acme',
  repo: 'treepad',
  branch: 'main',
  path: '',
}

describe('useTreeStore', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    getExpandedIdsMock.mockResolvedValue(null)
    setExpandedIdsMock.mockResolvedValue(undefined)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('maintains visibleNodes incrementally for expand and collapse', async () => {
    const { useTreeStore } = await import('./tree')
    const store = useTreeStore()

    await store.setNodes(nodes, repo)

    expect(store.visibleNodes.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/index.ts',
      'README.md',
    ])

    store.toggleExpand(1)
    expect(store.visibleNodes.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/utils/a.ts',
      'src/utils/b.ts',
      'src/index.ts',
      'README.md',
    ])

    store.toggleExpand(1)
    expect(store.visibleNodes.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/index.ts',
      'README.md',
    ])
  })

  it('expands ancestors for selectPath without recomputing unrelated roots', async () => {
    const { useTreeStore } = await import('./tree')
    const store = useTreeStore()

    getExpandedIdsMock.mockResolvedValue([])
    await store.setNodes(nodes, repo)

    expect(store.visibleNodes.map((node) => node.path)).toEqual([
      'src',
      'README.md',
    ])

    store.selectPath('src/utils/b.ts')
    expect(store.visibleNodes.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/utils/a.ts',
      'src/utils/b.ts',
      'src/index.ts',
      'README.md',
    ])
    expect(store.selectedPath).toBe('src/utils/b.ts')
  })
})
