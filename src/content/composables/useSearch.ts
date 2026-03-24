import { ref, computed, watch } from 'vue'
import Fuse from 'fuse.js'
import { useDebounceFn } from '@vueuse/core'
import { useTreeStore } from '../stores/tree'
import { SEARCH_DEBOUNCE_MS, SEARCH_FUSE_THRESHOLD } from '../../shared/constants'
import type { FlatNode } from '../../shared/types'

export interface SearchResult {
  node: FlatNode
  matches?: ReadonlyArray<{ indices: readonly [number, number][] }>
}

function scoreShortQuery(node: FlatNode, query: string): number {
  const name = node.name.toLowerCase()
  const path = node.path.toLowerCase()

  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.includes(query)) return 2
  if (path.endsWith(query)) return 3
  if (path.includes(query)) return 4
  return Number.POSITIVE_INFINITY
}

export function useSearch() {
  const store = useTreeStore()
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const isSearching = computed(() => query.value.length > 0)

  let fuse: Fuse<FlatNode> | null = null

  // Rebuild Fuse index when nodes change
  watch(
    () => store.nodes,
    (nodes) => {
      fuse = new Fuse(nodes, {
        keys: ['name', 'path'],
        threshold: SEARCH_FUSE_THRESHOLD,
        includeMatches: true,
        ignoreLocation: true,
      })
    },
    { immediate: true },
  )

  const doSearch = useDebounceFn((q: string) => {
    if (!q) {
      results.value = []
      return
    }

    if (q.length <= 2) {
      const lower = q.toLowerCase()
      results.value = store.nodes
        .filter((node) => !node.isDir) // short queries: files only, directories add noise
        .map((node) => ({
          node,
          score: scoreShortQuery(node, lower),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((a, b) => a.score - b.score || a.node.path.length - b.node.path.length)
        .slice(0, 50)
        .map(({ node }) => ({ node }))
    } else if (fuse) {
      // Fuse.js fuzzy search
      results.value = fuse
        .search(q, { limit: 50 })
        .map((r) => ({
          node: r.item,
          matches: r.matches?.map((m) => ({ indices: m.indices })),
        }))
    }
  }, SEARCH_DEBOUNCE_MS)

  watch(query, (q) => doSearch(q))

  function clear() {
    query.value = ''
    results.value = []
  }

  return { query, results, isSearching, clear }
}
