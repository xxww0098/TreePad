import type { FlatNode } from '../../shared/types'

export function computeVisibleNodes(
  nodes: FlatNode[],
  expandedIds: Set<number>,
): FlatNode[] {
  const result: FlatNode[] = []
  let i = 0

  while (i < nodes.length) {
    const node = nodes[i]
    result.push(node)

    if (node.isDir && !expandedIds.has(node.idx)) {
      i = node.subtreeEnd
    } else {
      i++
    }
  }

  return result
}

export function buildVisibleSubtree(
  nodes: FlatNode[],
  expandedIds: Set<number>,
  startIdx: number,
  endIdx: number,
): FlatNode[] {
  const result: FlatNode[] = []
  let i = startIdx

  while (i < endIdx) {
    const node = nodes[i]
    result.push(node)

    if (node.isDir && !expandedIds.has(node.idx)) {
      i = node.subtreeEnd
    } else {
      i++
    }
  }

  return result
}

function findVisibleNodeIndex(visibleNodes: FlatNode[], nodeIdx: number): number {
  return visibleNodes.findIndex((node) => node.idx === nodeIdx)
}

export function expandVisibleNodes(
  nodes: FlatNode[],
  visibleNodes: FlatNode[],
  expandedIds: Set<number>,
  nodeIdx: number,
): FlatNode[] {
  const node = nodes[nodeIdx]
  if (!node?.isDir) return visibleNodes

  const visibleIdx = findVisibleNodeIndex(visibleNodes, nodeIdx)
  if (visibleIdx < 0) return visibleNodes

  const inserted = buildVisibleSubtree(
    nodes,
    expandedIds,
    nodeIdx + 1,
    node.subtreeEnd,
  )

  if (inserted.length === 0) return visibleNodes

  return [
    ...visibleNodes.slice(0, visibleIdx + 1),
    ...inserted,
    ...visibleNodes.slice(visibleIdx + 1),
  ]
}

export function collapseVisibleNodes(
  visibleNodes: FlatNode[],
  nodeIdx: number,
  subtreeEnd: number,
): FlatNode[] {
  const visibleIdx = findVisibleNodeIndex(visibleNodes, nodeIdx)
  if (visibleIdx < 0) return visibleNodes

  let removeEnd = visibleIdx + 1
  while (removeEnd < visibleNodes.length && visibleNodes[removeEnd].idx < subtreeEnd) {
    removeEnd++
  }

  if (removeEnd === visibleIdx + 1) return visibleNodes

  return [
    ...visibleNodes.slice(0, visibleIdx + 1),
    ...visibleNodes.slice(removeEnd),
  ]
}
