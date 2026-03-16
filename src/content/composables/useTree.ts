import { computed, watch } from 'vue'
import { useTreeStore } from '../stores/tree'
import type { FlatNode, RepoInfo } from '../../shared/types'
import { useGitHub } from './useGitHub'

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
      i = node.subtreeEnd // O(1) skip collapsed subtree
    } else {
      i++
    }
  }
  return result
}

export function useTree() {
  const store = useTreeStore()
  const { repoInfo } = useGitHub()

  const visibleNodes = computed(() =>
    computeVisibleNodes(store.nodes, store.expandedIds),
  )

  async function fetchTree(info: RepoInfo) {
    if (!info.owner || !info.repo) return

    store.loading = true
    store.error = null

    // Show repo name from URL immediately, even before API responds
    if (!store.currentRepo || store.currentRepo.owner !== info.owner || store.currentRepo.repo !== info.repo) {
      store.currentRepo = { ...info, branch: info.branch || '' }
    }

    try {
      let branch = info.branch
      if (!branch) {
        // Fetch default branch
        const res = await chrome.runtime.sendMessage({
          type: 'FETCH_BRANCHES',
          owner: info.owner,
          repo: info.repo,
        })
        if (res.error) throw new Error(res.error)
        branch = res.branch
      }

      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_TREE',
        owner: info.owner,
        repo: info.repo,
        branch,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      await store.setNodes(response.nodes, { ...info, branch })

      // If URL has a path, select it
      if (info.path) {
        store.selectPath(info.path)
      }
    } catch (err) {
      store.error = err instanceof Error ? err.message : 'Failed to load tree'
    } finally {
      store.loading = false
    }
  }

  // Watch for repo changes and refetch
  watch(
    repoInfo,
    (newInfo, oldInfo) => {
      if (!newInfo) return

      // Only refetch if repo or branch changed
      const repoChanged =
        !oldInfo ||
        newInfo.owner !== oldInfo.owner ||
        newInfo.repo !== oldInfo.repo ||
        (newInfo.branch && newInfo.branch !== oldInfo.branch)

      if (repoChanged) {
        fetchTree(newInfo)
      } else if (newInfo.path !== oldInfo?.path) {
        // Just update selected path
        store.selectPath(newInfo.path)
      }
    },
    { immediate: true },
  )

  return { visibleNodes, repoInfo }
}
