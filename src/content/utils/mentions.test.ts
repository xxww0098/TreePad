import { describe, expect, it } from 'vitest'
import type { FlatNode } from '../../shared/types'
import { buildMentionItems, partitionMentionNodes } from './mentions'

function makeNode(overrides: Partial<FlatNode> & Pick<FlatNode, 'idx' | 'name' | 'path' | 'isDir'>): FlatNode {
  return {
    depth: 0,
    parentIdx: -1,
    childCount: 0,
    subtreeEnd: overrides.idx + 1,
    ...overrides,
  }
}

describe('partitionMentionNodes', () => {
  it('splits files and folders in a single pass', () => {
    const nodes = [
      makeNode({ idx: 0, name: 'src', path: 'src', isDir: true }),
      makeNode({ idx: 1, name: 'app.ts', path: 'src/app.ts', isDir: false }),
      makeNode({ idx: 2, name: 'README.md', path: 'README.md', isDir: false }),
    ]

    expect(partitionMentionNodes(nodes)).toEqual({
      folders: [nodes[0]],
      files: [nodes[1], nodes[2]],
    })
  })
})

describe('buildMentionItems', () => {
  const buckets = partitionMentionNodes([
    makeNode({ idx: 0, name: 'src', path: 'src', isDir: true }),
    makeNode({ idx: 1, name: 'docs', path: 'docs', isDir: true }),
    makeNode({ idx: 2, name: 'app.ts', path: 'src/app.ts', isDir: false }),
    makeNode({ idx: 3, name: 'api.ts', path: 'src/api.ts', isDir: false }),
    makeNode({ idx: 4, name: 'README.md', path: 'README.md', isDir: false }),
  ])

  it('returns unattached files first when query is empty', () => {
    const result = buildMentionItems(buckets, new Set(['src/api.ts']), '')
    expect(result.map((node) => node.path)).toEqual([
      'src/app.ts',
      'README.md',
      'src',
      'docs',
    ])
  })

  it('filters attached files but still keeps folders available for matching', () => {
    const result = buildMentionItems(buckets, new Set(['src/app.ts']), 'src')
    expect(result.map((node) => node.path)).toEqual([
      'src',
      'src/api.ts',
    ])
  })
})
