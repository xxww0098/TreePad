import { ref, onMounted, onUnmounted } from 'vue'
import type { RepoInfo } from '../../shared/types'

export function parseGitHubURL(url: string): RepoInfo | null {
  const match = url.match(
    /github\.com\/([^/?#]+)\/([^/?#]+)(?:\/(tree|blob)\/([^?#]+?))?(?:[?#]|$)/,
  )
  if (!match) return null

  const owner = match[1]
  const repo = match[2]

  // Skip special GitHub pages
  if (['settings', 'pulls', 'issues', 'actions', 'projects', 'wiki', 'security', 'pulse', 'graphs'].includes(owner)) {
    return null
  }

  if (!match[3]) {
    // Repo root, no branch/path info in URL
    return { owner, repo, branch: '', path: '' }
  }

  const rest = match[4] || ''
  // The branch could contain slashes, so we need to figure out where branch ends and path begins
  // For MVP, we take the first segment as branch
  const slashIdx = rest.indexOf('/')
  const branch = slashIdx === -1 ? rest : rest.slice(0, slashIdx)
  const path = slashIdx === -1 ? '' : rest.slice(slashIdx + 1)

  return {
    owner,
    repo,
    type: match[3] as 'tree' | 'blob',
    branch,
    path,
  }
}

export function useGitHub() {
  const repoInfo = ref<RepoInfo | null>(null)

  function update() {
    repoInfo.value = parseGitHubURL(location.href)
  }

  let observer: MutationObserver | null = null

  onMounted(() => {
    update()

    // Listen for SPA navigation
    window.addEventListener('popstate', update)

    // MutationObserver on <title> for Turbo/PJAX navigation
    const titleEl = document.querySelector('title')
    if (titleEl) {
      observer = new MutationObserver(update)
      observer.observe(titleEl, { childList: true })
    }

    // Also listen for turbo:load if available
    document.addEventListener('turbo:load', update)
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', update)
    observer?.disconnect()
    document.removeEventListener('turbo:load', update)
  })

  return { repoInfo, refresh: update }
}
