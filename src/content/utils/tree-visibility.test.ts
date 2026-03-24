import { describe, expect, it } from 'vitest'
import type { FlatNode } from '../../shared/types'
import {
  buildVisibleSubtree,
  collapseVisibleNodes,
  computeVisibleNodes,
  expandVisibleNodes,
} from './tree-visibility'

const nodes: FlatNode[] = [
  { idx: 0, name: 'src', path: 'src', depth: 0, isDir: true, parentIdx: -1, childCount: 2, subtreeEnd: 5 },
  { idx: 1, name: 'utils', path: 'src/utils', depth: 1, isDir: true, parentIdx: 0, childCount: 2, subtreeEnd: 4 },
  { idx: 2, name: 'a.ts', path: 'src/utils/a.ts', depth: 2, isDir: false, parentIdx: 1, childCount: 0, subtreeEnd: 3 },
  { idx: 3, name: 'b.ts', path: 'src/utils/b.ts', depth: 2, isDir: false, parentIdx: 1, childCount: 0, subtreeEnd: 4 },
  { idx: 4, name: 'index.ts', path: 'src/index.ts', depth: 1, isDir: false, parentIdx: 0, childCount: 0, subtreeEnd: 5 },
  { idx: 5, name: 'docs', path: 'docs', depth: 0, isDir: true, parentIdx: -1, childCount: 1, subtreeEnd: 7 },
  { idx: 6, name: 'guide.md', path: 'docs/guide.md', depth: 1, isDir: false, parentIdx: 5, childCount: 0, subtreeEnd: 7 },
  { idx: 7, name: 'README.md', path: 'README.md', depth: 0, isDir: false, parentIdx: -1, childCount: 0, subtreeEnd: 8 },
]

describe('tree visibility helpers', () => {
  it('computes the initial visible list while skipping collapsed subtrees', () => {
    const visible = computeVisibleNodes(nodes, new Set())
    expect(visible.map((node) => node.path)).toEqual([
      'src',
      'docs',
      'README.md',
    ])
  })

  it('builds only the visible part of an expanded subtree', () => {
    const visible = buildVisibleSubtree(nodes, new Set([0]), 1, nodes[0].subtreeEnd)
    expect(visible.map((node) => node.path)).toEqual([
      'src/utils',
      'src/index.ts',
    ])
  })

  it('inserts only the newly visible descendants when a directory expands', () => {
    const initiallyVisible = computeVisibleNodes(nodes, new Set([0]))
    const expanded = expandVisibleNodes(
      nodes,
      initiallyVisible,
      new Set([0, 1]),
      1,
    )

    expect(expanded.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/utils/a.ts',
      'src/utils/b.ts',
      'src/index.ts',
      'docs',
      'README.md',
    ])
  })

  it('removes only the collapsed subtree from the current visible list', () => {
    const visible = computeVisibleNodes(nodes, new Set([0, 1]))
    const collapsed = collapseVisibleNodes(
      visible,
      1,
      nodes[1].subtreeEnd,
    )

    expect(collapsed.map((node) => node.path)).toEqual([
      'src',
      'src/utils',
      'src/index.ts',
      'docs',
      'README.md',
    ])
  })
})
