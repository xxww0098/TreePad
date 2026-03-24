import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { FlatNode, RepoInfo } from '../../shared/types'
import { getExpandedIds, setExpandedIds } from '../../shared/cache'
import {
  collapseVisibleNodes,
  computeVisibleNodes,
  expandVisibleNodes,
} from '../utils/tree-visibility'

export const useTreeStore = defineStore('tree', () => {
  const nodes = shallowRef<FlatNode[]>([])
  const pathToIdx = shallowRef(new Map<string, number>())
  const visibleNodes = shallowRef<FlatNode[]>([])
  const expandedIds = ref(new Set<number>())
  const selectedPath = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentRepo = ref<RepoInfo | null>(null)

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  async function setNodes(newNodes: FlatNode[], repo: RepoInfo) {
    nodes.value = newNodes
    pathToIdx.value = new Map(newNodes.map((node) => [node.path, node.idx]))
    currentRepo.value = repo

    // Restore expanded state
    const saved = await getExpandedIds(repo.owner, repo.repo)
    if (saved) {
      expandedIds.value = new Set(saved)
    } else {
      // Auto-expand root directories
      expandedIds.value = new Set(
        newNodes.filter((n) => n.isDir && n.depth === 0).map((n) => n.idx),
      )
    }

    visibleNodes.value = computeVisibleNodes(newNodes, expandedIds.value)
  }

  function toggleExpand(idx: number) {
    const node = nodes.value[idx]
    if (!node?.isDir) return

    const newSet = new Set(expandedIds.value)
    if (newSet.has(idx)) {
      newSet.delete(idx)
      visibleNodes.value = collapseVisibleNodes(
        visibleNodes.value,
        idx,
        node.subtreeEnd,
      )
    } else {
      newSet.add(idx)
      visibleNodes.value = expandVisibleNodes(
        nodes.value,
        visibleNodes.value,
        newSet,
        idx,
      )
    }
    expandedIds.value = newSet
    persistExpandedDebounced()
  }

  function expandTo(path: string) {
    const nodeIdx = pathToIdx.value.get(path)
    if (nodeIdx === undefined) return

    const ancestorIndices: number[] = []
    const newSet = new Set(expandedIds.value)
    let current = nodes.value[nodeIdx]
    while (current.parentIdx >= 0) {
      ancestorIndices.push(current.parentIdx)
      current = nodes.value[current.parentIdx]
    }
    ancestorIndices.reverse()

    let nextVisibleNodes = visibleNodes.value
    let changed = false

    for (const ancestorIdx of ancestorIndices) {
      if (newSet.has(ancestorIdx)) continue
      newSet.add(ancestorIdx)
      nextVisibleNodes = expandVisibleNodes(
        nodes.value,
        nextVisibleNodes,
        newSet,
        ancestorIdx,
      )
      changed = true
    }

    if (!changed) return

    expandedIds.value = newSet
    visibleNodes.value = nextVisibleNodes
    persistExpandedDebounced()
  }

  function selectPath(path: string) {
    selectedPath.value = path
    expandTo(path)
  }

  function persistExpandedDebounced() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistExpanded()
      persistTimer = null
    }, 300)
  }

  function persistExpanded() {
    const repo = currentRepo.value
    if (repo) {
      setExpandedIds(repo.owner, repo.repo, [...expandedIds.value])
    }
  }

  function collapseAll() {
    expandedIds.value = new Set()
    visibleNodes.value = computeVisibleNodes(nodes.value, expandedIds.value)
    persistExpandedDebounced()
  }

  return {
    nodes,
    visibleNodes,
    expandedIds,
    selectedPath,
    loading,
    error,
    currentRepo,
    setNodes,
    toggleExpand,
    expandTo,
    selectPath,
    collapseAll,
  }
})
