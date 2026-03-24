import type { FlatNode } from './types'

/**
 * Collect all file nodes (non-directories) within a subtree defined by a directory node.
 */
export function collectSubtreeFiles(allNodes: FlatNode[], dirNode: FlatNode): FlatNode[] {
  const files: FlatNode[] = []
  for (let i = dirNode.idx + 1; i < dirNode.subtreeEnd; i++) {
    if (!allNodes[i].isDir) {
      files.push(allNodes[i])
    }
  }
  return files
}
