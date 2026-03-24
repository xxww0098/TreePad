import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTreeStore } from '../stores/tree'
import type { RepoInfo } from '../../shared/types'
import { resolveMatchedGitHubRef, useGitHub } from './useGitHub'

export function useTree() {
  const store = useTreeStore()
  const { repoInfo } = useGitHub()
  const { visibleNodes } = storeToRefs(store)

  function getPathForKnownBranch(info: RepoInfo, branch: string | undefined): string | null {
    if (!info.type || !info.rawRef || !branch) return null
    if (info.rawRef === branch) return ''
    if (info.rawRef.startsWith(`${branch}/`)) {
      return info.rawRef.slice(branch.length + 1)
    }
    return null
  }

  async function resolveRepoInfo(info: RepoInfo): Promise<RepoInfo> {
    let branch = info.branch
    let path = info.path

    if (!branch) {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_BRANCHES',
        owner: info.owner,
        repo: info.repo,
      })
      if (res.error) throw new Error(res.error)
      branch = res.branch
    } else if (info.type && info.rawRef?.includes('/')) {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_BRANCH_MATCHES',
        owner: info.owner,
        repo: info.repo,
        prefix: branch,
      })
      if (res.error) throw new Error(res.error)
      const matched = resolveMatchedGitHubRef(
        info.rawRef,
        Array.isArray(res.branches) ? res.branches : [],
      )
      if (matched) {
        branch = matched.branch
        path = matched.path
      }
    }

    return {
      ...info,
      branch,
      path,
    }
  }

  async function fetchTree(info: RepoInfo) {
    if (!info.owner || !info.repo) return

    store.loading = true
    store.error = null

    // Show repo name from URL immediately, even before API responds
    if (!store.currentRepo || store.currentRepo.owner !== info.owner || store.currentRepo.repo !== info.repo) {
      store.currentRepo = { ...info, branch: info.branch || '' }
    }

    try {
      const resolvedInfo = await resolveRepoInfo(info)

      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_TREE',
        owner: resolvedInfo.owner,
        repo: resolvedInfo.repo,
        branch: resolvedInfo.branch,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      await store.setNodes(response.nodes, resolvedInfo)

      // If URL has a path, select it
      if (resolvedInfo.path) {
        store.selectPath(resolvedInfo.path)
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
        newInfo.repo !== oldInfo.repo

      const knownBranch = store.currentRepo?.branch
      const branchPath = getPathForKnownBranch(newInfo, knownBranch)
      const branchChanged =
        !repoChanged &&
        branchPath === null &&
        !!newInfo.branch &&
        newInfo.branch !== (knownBranch || oldInfo?.branch)

      if (repoChanged || branchChanged) {
        fetchTree(newInfo)
      } else {
        // Just update selected path
        store.selectPath(branchPath ?? newInfo.path)
      }
    },
    { immediate: true },
  )

  return { visibleNodes, repoInfo }
}
