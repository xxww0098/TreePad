import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { FlatNode, RepoInfo } from '../../shared/types'
import { getExpandedIds, setExpandedIds } from '../../shared/cache'

export const useTreeStore = defineStore('tree', () => {
  const nodes = shallowRef<FlatNode[]>([])
  const expandedIds = ref(new Set<number>())
  const selectedPath = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentRepo = ref<RepoInfo | null>(null)

  async function setNodes(newNodes: FlatNode[], repo: RepoInfo) {
    nodes.value = newNodes
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
  }

  function toggleExpand(idx: number) {
    const newSet = new Set(expandedIds.value)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    expandedIds.value = newSet
    persistExpanded()
  }

  function expandTo(path: string) {
    // Expand all parent directories of the given path
    const newSet = new Set(expandedIds.value)
    for (const node of nodes.value) {
      if (node.isDir && path.startsWith(node.path + '/')) {
        newSet.add(node.idx)
      }
    }
    expandedIds.value = newSet
    persistExpanded()
  }

  function selectPath(path: string) {
    selectedPath.value = path
    expandTo(path)
  }

  function persistExpanded() {
    const repo = currentRepo.value
    if (repo) {
      setExpandedIds(repo.owner, repo.repo, [...expandedIds.value])
    }
  }

  function collapseAll() {
    expandedIds.value = new Set()
    persistExpanded()
  }

  return {
    nodes,
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
