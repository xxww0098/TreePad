import type { GitTreeEntry, FlatNode } from './types'

interface TreeDir {
  name: string
  path: string
  children: Map<string, TreeDir | TreeFile>
}

interface TreeFile {
  name: string
  path: string
}

function isDir(node: TreeDir | TreeFile): node is TreeDir {
  return 'children' in node
}

/**
 * Build a flat array of FlatNode from GitHub API tree entries.
 * Uses DFS ordering with subtreeEnd for O(1) collapse skip.
 */
export function buildFlatNodes(entries: GitTreeEntry[]): FlatNode[] {
  // Step 1: Build an in-memory tree structure
  const root: TreeDir = { name: '', path: '', children: new Map() }

  for (const entry of entries) {
    const parts = entry.path.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (isLast && entry.type === 'blob') {
        current.children.set(part, { name: part, path: entry.path })
      } else {
        let child = current.children.get(part)
        if (!child || !isDir(child)) {
          child = { name: part, path: currentPath, children: new Map() }
          current.children.set(part, child)
        }
        current = child
      }
    }
  }

  // Step 2: DFS to produce FlatNode[]
  const result: FlatNode[] = []

  function dfs(dir: TreeDir, depth: number, parentIdx: number) {
    // Sort children: directories first, then alphabetical (case-insensitive)
    const sorted = [...dir.children.values()].sort((a, b) => {
      const aIsDir = isDir(a) ? 0 : 1
      const bIsDir = isDir(b) ? 0 : 1
      if (aIsDir !== bIsDir) return aIsDir - bIsDir
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    for (const child of sorted) {
      const idx = result.length
      if (isDir(child)) {
        const node: FlatNode = {
          idx,
          name: child.name,
          path: child.path,
          depth,
          isDir: true,
          parentIdx,
          childCount: 0,
          subtreeEnd: 0, // filled after DFS
        }
        result.push(node)

        dfs(child, depth + 1, idx)

        node.subtreeEnd = result.length
        node.childCount = child.children.size
      } else {
        result.push({
          idx,
          name: child.name,
          path: child.path,
          depth,
          isDir: false,
          parentIdx,
          childCount: 0,
          subtreeEnd: idx + 1,
        })
      }
    }
  }

  dfs(root, 0, -1)
  return result
}
