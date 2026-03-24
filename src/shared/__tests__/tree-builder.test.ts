import { describe, it, expect } from 'vitest'
import { buildFlatNodes } from '../../shared/tree-builder'
import type { GitTreeEntry } from '../../shared/types'

function makeBlob(path: string): GitTreeEntry {
  return { path, type: 'blob', mode: '100644', sha: 'abc', size: 100 }
}

function makeTree(path: string): GitTreeEntry {
  return { path, type: 'tree', mode: '040000', sha: 'def' }
}

describe('buildFlatNodes', () => {
  it('空 tree 返回空数组', () => {
    expect(buildFlatNodes([])).toEqual([])
  })

  it('单个文件', () => {
    const nodes = buildFlatNodes([makeBlob('README.md')])
    expect(nodes).toHaveLength(1)
    expect(nodes[0].name).toBe('README.md')
    expect(nodes[0].isDir).toBe(false)
    expect(nodes[0].depth).toBe(0)
    expect(nodes[0].parentIdx).toBe(-1)
    expect(nodes[0].idx).toBe(0)
  })

  it('目录 + 子文件', () => {
    const nodes = buildFlatNodes([
      makeTree('src'),
      makeBlob('src/main.ts'),
    ])
    // 根目录 src
    expect(nodes[0].name).toBe('src')
    expect(nodes[0].isDir).toBe(true)
    expect(nodes[0].depth).toBe(0)
    // 子文件
    expect(nodes[1].name).toBe('main.ts')
    expect(nodes[1].isDir).toBe(false)
    expect(nodes[1].depth).toBe(1)
    expect(nodes[1].parentIdx).toBe(0)
  })

  it('目录排在文件之前（同级）', () => {
    const nodes = buildFlatNodes([
      makeBlob('z_file.ts'),
      makeTree('a_dir'),
      makeBlob('a_dir/child.ts'),
    ])
    expect(nodes[0].name).toBe('a_dir')
    expect(nodes[0].isDir).toBe(true)
    expect(nodes[nodes.length - 1].name).toBe('z_file.ts')
  })

  it('同级文件按名称字母排序（不区分大小写）', () => {
    const nodes = buildFlatNodes([
      makeBlob('Zebra.ts'),
      makeBlob('apple.ts'),
      makeBlob('Mango.ts'),
    ])
    const names = nodes.map((n) => n.name)
    expect(names).toEqual(['apple.ts', 'Mango.ts', 'Zebra.ts'])
  })

  it('subtreeEnd 正确指向目录子树结束位置', () => {
    const nodes = buildFlatNodes([
      makeTree('dir'),
      makeBlob('dir/a.ts'),
      makeBlob('dir/b.ts'),
      makeBlob('root.ts'),
    ])
    const dir = nodes.find((n) => n.name === 'dir')!
    // dir 下有 a.ts, b.ts → subtreeEnd = dir.idx + 3
    expect(dir.subtreeEnd).toBe(dir.idx + 3)
  })

  it('深层路径（三级嵌套）', () => {
    const nodes = buildFlatNodes([
      makeTree('a'),
      makeTree('a/b'),
      makeBlob('a/b/c.ts'),
    ])
    const c = nodes.find((n) => n.name === 'c.ts')!
    expect(c.depth).toBe(2)
    expect(c.path).toBe('a/b/c.ts')
  })

  it('childCount 等于直接子节点数量', () => {
    const nodes = buildFlatNodes([
      makeTree('dir'),
      makeBlob('dir/a.ts'),
      makeBlob('dir/b.ts'),
      makeTree('dir/sub'),
      makeBlob('dir/sub/c.ts'),
    ])
    const dir = nodes.find((n) => n.name === 'dir')!
    // 直接子节点：a.ts, b.ts, sub → 3
    expect(dir.childCount).toBe(3)
  })

  it('idx 严格等于在数组中的位置', () => {
    const nodes = buildFlatNodes([
      makeTree('a'),
      makeBlob('a/x.ts'),
      makeBlob('b.ts'),
    ])
    nodes.forEach((n, i) => {
      expect(n.idx).toBe(i)
    })
  })

  it('特殊字符路径（空格、破折号）', () => {
    const nodes = buildFlatNodes([
      makeBlob('my file.ts'),
      makeBlob('kebab-case.ts'),
    ])
    expect(nodes.map((n) => n.name)).toContain('my file.ts')
    expect(nodes.map((n) => n.name)).toContain('kebab-case.ts')
  })
})
