import { del, delMany, get, set, update } from 'idb-keyval'
import {
  CACHE_PREFIX,
  CACHE_MAX_AGE,
  DEFAULT_BRANCH_CACHE_MAX_ENTRIES,
  TREE_CACHE_MAX_ENTRIES,
} from './constants'
import type { TreeCacheEntry, FlatNode, BranchCacheEntry } from './types'

const DEFAULT_BRANCH_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // 7 days
const TREE_CACHE_INDEX_KEY = `${CACHE_PREFIX}index:tree`
const DEFAULT_BRANCH_CACHE_INDEX_KEY = `${CACHE_PREFIX}index:default-branch`

type CacheAccessIndex = Record<string, number>

function cacheKey(owner: string, repo: string, branch: string): string {
  return `${CACHE_PREFIX}${owner}/${repo}:${branch}`
}

function defaultBranchCacheKey(owner: string, repo: string): string {
  return `${CACHE_PREFIX}default-branch:${owner}/${repo}`
}

async function removeIndexedCacheKey(indexKey: string, entryKey: string): Promise<void> {
  await update<CacheAccessIndex>(indexKey, (current = {}) => {
    if (!(entryKey in current)) return current
    const next = { ...current }
    delete next[entryKey]
    return next
  })
}

async function touchIndexedCacheKey(
  indexKey: string,
  entryKey: string,
  maxEntries: number,
): Promise<void> {
  let evictedKeys: string[] = []

  await update<CacheAccessIndex>(indexKey, (current = {}) => {
    const indexed = {
      ...current,
      [entryKey]: Date.now(),
    }
    const sorted = Object.entries(indexed).sort((a, b) => b[1] - a[1])

    evictedKeys = sorted.slice(maxEntries).map(([key]) => key)
    return Object.fromEntries(sorted.slice(0, maxEntries))
  })

  if (evictedKeys.length) {
    await delMany(evictedKeys)
  }
}

function refreshIndexedCacheKey(indexKey: string, entryKey: string, maxEntries: number): void {
  void touchIndexedCacheKey(indexKey, entryKey, maxEntries).catch(() => {
    // Cache eviction is best-effort and should not block reads.
  })
}

async function invalidateCacheEntry(
  key: string,
  indexKey: string,
): Promise<void> {
  await Promise.all([
    del(key),
    removeIndexedCacheKey(indexKey, key),
  ])
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
  if ((currentSha && entry.sha !== currentSha) || Date.now() - entry.timestamp > CACHE_MAX_AGE) {
    await invalidateCacheEntry(key, TREE_CACHE_INDEX_KEY)
    return null
  }

  refreshIndexedCacheKey(TREE_CACHE_INDEX_KEY, key, TREE_CACHE_MAX_ENTRIES)
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
  await touchIndexedCacheKey(TREE_CACHE_INDEX_KEY, key, TREE_CACHE_MAX_ENTRIES)
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
  const key = defaultBranchCacheKey(owner, repo)
  const entry = await get<BranchCacheEntry>(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > DEFAULT_BRANCH_CACHE_MAX_AGE) {
    await invalidateCacheEntry(key, DEFAULT_BRANCH_CACHE_INDEX_KEY)
    return null
  }
  refreshIndexedCacheKey(DEFAULT_BRANCH_CACHE_INDEX_KEY, key, DEFAULT_BRANCH_CACHE_MAX_ENTRIES)
  return entry.branch
}

export async function setCachedDefaultBranch(
  owner: string,
  repo: string,
  branch: string,
): Promise<void> {
  const key = defaultBranchCacheKey(owner, repo)
  await set(key, {
    branch,
    timestamp: Date.now(),
  } satisfies BranchCacheEntry)
  await touchIndexedCacheKey(DEFAULT_BRANCH_CACHE_INDEX_KEY, key, DEFAULT_BRANCH_CACHE_MAX_ENTRIES)
}
