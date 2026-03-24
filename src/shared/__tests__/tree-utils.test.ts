import { describe, it, expect } from 'vitest'
import { collectSubtreeFiles } from '../../shared/tree-utils'
import type { FlatNode } from '../../shared/types'

function makeNode(overrides: Partial<FlatNode> & Pick<FlatNode, 'idx' | 'name' | 'isDir'>): FlatNode {
  return {
    path: overrides.name,
    depth: 0,
    parentIdx: -1,
    childCount: 0,
    subtreeEnd: overrides.idx + 1,
    ...overrides,
  }
}

describe('collectSubtreeFiles', () => {
  // 模拟一个典型的 flat node 数组：
  // [0] dir/       isDir, subtreeEnd=4
  // [1]   a.ts     file
  // [2]   sub/     isDir, subtreeEnd=4
  // [3]     b.ts   file
  // [4] root.ts    file
  const nodes: FlatNode[] = [
    makeNode({ idx: 0, name: 'dir', isDir: true, depth: 0, parentIdx: -1, childCount: 2, subtreeEnd: 4 }),
    makeNode({ idx: 1, name: 'a.ts', path: 'dir/a.ts', isDir: false, depth: 1, parentIdx: 0 }),
    makeNode({ idx: 2, name: 'sub', path: 'dir/sub', isDir: true, depth: 1, parentIdx: 0, childCount: 1, subtreeEnd: 4 }),
    makeNode({ idx: 3, name: 'b.ts', path: 'dir/sub/b.ts', isDir: false, depth: 2, parentIdx: 2 }),
    makeNode({ idx: 4, name: 'root.ts', path: 'root.ts', isDir: false, depth: 0, parentIdx: -1 }),
  ]

  it('收集目录下所有文件（递归，不含目录自身）', () => {
    const files = collectSubtreeFiles(nodes, nodes[0])
    expect(files).toHaveLength(2)
    expect(files.map((f) => f.name)).toEqual(['a.ts', 'b.ts'])
  })

  it('只收集子目录内的文件', () => {
    const files = collectSubtreeFiles(nodes, nodes[2])
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('b.ts')
  })

  it('空目录返回空数组', () => {
    const emptyDir = makeNode({ idx: 0, name: 'empty', isDir: true, subtreeEnd: 1 })
    const result = collectSubtreeFiles([emptyDir], emptyDir)
    expect(result).toEqual([])
  })

  it('不包含子目录以外的节点（root.ts 不在结果中）', () => {
    const files = collectSubtreeFiles(nodes, nodes[0])
    expect(files.map((f) => f.path)).not.toContain('root.ts')
  })

  it('不返回目录节点', () => {
    const files = collectSubtreeFiles(nodes, nodes[0])
    expect(files.every((f) => !f.isDir)).toBe(true)
  })
})
