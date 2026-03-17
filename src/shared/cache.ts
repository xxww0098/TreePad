import { get, set, del } from 'idb-keyval'
import { CACHE_PREFIX, CACHE_MAX_AGE } from './constants'
import type { TreeCacheEntry, FlatNode, BranchCacheEntry } from './types'

const DEFAULT_BRANCH_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 days

function cacheKey(owner: string, repo: string, branch: string): string {
  return `${CACHE_PREFIX}${owner}/${repo}:${branch}`
}

function defaultBranchCacheKey(owner: string, repo: string): string {
  return `${CACHE_PREFIX}default-branch:${owner}/${repo}`
}

export async function getCachedTree(
  owner: string,
  repo: string,
  branch: string,
  currentSha?: string,
): Promise<FlatNode[] | null> {
  const key = cacheKey(owner, repo, branch)
  const entry = await get<TreeCacheEntry>(key)
  if (!entry) return null

  // Invalidate if SHA changed or cache is too old
  if (currentSha && entry.sha !== currentSha) {
    await del(key)
    return null
  }
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE) {
    await del(key)
    return null
  }

  return entry.nodes
}

export async function setCachedTree(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  nodes: FlatNode[],
): Promise<void> {
  const key = cacheKey(owner, repo, branch)
  await set(key, { sha, nodes, timestamp: Date.now() } satisfies TreeCacheEntry)
}

export async function getExpandedIds(
  owner: string,
  repo: string,
): Promise<number[] | null> {
  return (await get<number[]>(`${CACHE_PREFIX}expanded:${owner}/${repo}`)) ?? null
}

export async function setExpandedIds(
  owner: string,
  repo: string,
  ids: number[],
): Promise<void> {
  await set(`${CACHE_PREFIX}expanded:${owner}/${repo}`, ids)
}

export async function getCachedDefaultBranch(
  owner: string,
  repo: string,
): Promise<string | null> {
  const entry = await get<BranchCacheEntry>(defaultBranchCacheKey(owner, repo))
  if (!entry) return null
  if (Date.now() - entry.timestamp > DEFAULT_BRANCH_CACHE_MAX_AGE) {
    await del(defaultBranchCacheKey(owner, repo))
    return null
  }
  return entry.branch
}

export async function setCachedDefaultBranch(
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  await set(defaultBranchCacheKey(owner, repo), {
    branch,
    timestamp: Date.now(),
  } satisfies BranchCacheEntry)
}
