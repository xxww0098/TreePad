import { describe, expect, it, vi } from 'vitest'
import type { FlatNode, RepoInfo } from '../../shared/types'
import type { AttachedFile } from '../composables/useConversationHistory'
import { ATTACHED_CONTEXT_CONCURRENCY, buildAttachedFilesContext } from './attached-context'

function makeNode(overrides: Partial<FlatNode> & Pick<FlatNode, 'idx' | 'name' | 'path' | 'isDir'>): FlatNode {
  return {
    depth: 0,
    parentIdx: -1,
    childCount: 0,
    subtreeEnd: overrides.idx + 1,
    ...overrides,
  }
}

const repo: RepoInfo = {
  owner: 'acme',
  repo: 'treepad',
  branch: 'main',
  path: '',
}

describe('buildAttachedFilesContext', () => {
  it('deduplicates files collected directly and through folders', async () => {
    const nodes: FlatNode[] = [
      makeNode({ idx: 0, name: 'src', path: 'src', isDir: true, childCount: 2, subtreeEnd: 3 }),
      makeNode({ idx: 1, name: 'app.ts', path: 'src/app.ts', isDir: false, depth: 1, parentIdx: 0 }),
      makeNode({ idx: 2, name: 'api.ts', path: 'src/api.ts', isDir: false, depth: 1, parentIdx: 0 }),
    ]

    const fetchFileContent = vi.fn(async (path: string) => `content:${path}`)

    const context = await buildAttachedFilesContext({
      repo,
      allNodes: nodes,
      files: [{ path: 'src/app.ts', name: 'app.ts' }],
      folders: [{ path: 'src', name: 'src' }],
      fetchFileContent,
    })

    expect(fetchFileContent).toHaveBeenCalledTimes(2)
    expect(context).toContain('File: src/app.ts')
    expect(context).toContain('File: src/api.ts')
  })

  it('limits parallel fetches to the configured concurrency', async () => {
    const files: AttachedFile[] = Array.from({ length: ATTACHED_CONTEXT_CONCURRENCY + 3 }, (_, idx) => ({
      path: `src/file-${idx}.ts`,
      name: `file-${idx}.ts`,
    }))

    let inFlight = 0
    let maxInFlight = 0
    const releaseQueue: Array<() => void> = []

    const fetchFileContent = vi.fn((path: string) => new Promise<string>((resolve) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      releaseQueue.push(() => {
        inFlight -= 1
        resolve(`content:${path}`)
      })
    }))

    const buildPromise = buildAttachedFilesContext({
      repo,
      allNodes: [],
      files,
      folders: [],
      fetchFileContent,
    })

    await Promise.resolve()
    expect(fetchFileContent).toHaveBeenCalledTimes(ATTACHED_CONTEXT_CONCURRENCY)
    expect(maxInFlight).toBe(ATTACHED_CONTEXT_CONCURRENCY)

    while (releaseQueue.length) {
      const release = releaseQueue.shift()
      release?.()
      await Promise.resolve()
    }

    await buildPromise
    expect(maxInFlight).toBe(ATTACHED_CONTEXT_CONCURRENCY)
  })
})
