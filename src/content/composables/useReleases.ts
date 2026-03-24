import { ref, readonly, computed, type Ref } from 'vue'
import type { RepoInfo, GitHubRelease, GitHubReleaseAsset } from '../../shared/types'
import { base64ToBytes, toPlainArrayBuffer } from '../../shared/encoding'

export interface ReleaseDownloadProgress {
  assetName: string
  status: 'downloading' | 'done' | 'error'
  error?: string
}

export type Platform = 'mac' | 'win' | 'linux' | 'unknown'
export type Arch = 'arm64' | 'x64' | 'x86' | 'unknown'

// ── Platform detection ──────────────────────────────────────

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'win'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function detectArch(): Arch {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64'
  if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('amd64') || ua.includes('wow64')) return 'x64'
  // On macOS, modern browsers on Apple Silicon may not include arch info in UA
  // but the platform is usually arm64
  if (detectPlatform() === 'mac') {
    // Heuristic: modern Macs are arm64, older are x64
    // Can't reliably determine from UA alone, so we show both
    return 'arm64'
  }
  return 'unknown'
}

// ── Asset classification ────────────────────────────────────

const PLATFORM_PATTERNS: Record<Platform, RegExp> = {
  mac: /mac|darwin|osx|macos|apple/i,
  win: /win|windows/i,
  linux: /linux|ubuntu|debian|fedora|centos|appimage|\.deb|\.rpm/i,
  unknown: /^$/,
}

const ARCH_PATTERNS: Record<Arch, RegExp> = {
  arm64: /arm64|aarch64|apple.?silicon/i,
  x64: /x86.?64|amd64|x64/i,
  x86: /x86|i[36]86|win32/i,
  unknown: /^$/,
}

const SOURCE_CODE_PATTERN = /^source.code.*\.(zip|tar\.gz)$/i

function isSourceCode(name: string): boolean {
  return SOURCE_CODE_PATTERN.test(name)
}

function assetMatchesPlatform(name: string, platform: Platform): boolean {
  if (platform === 'unknown') return false
  return PLATFORM_PATTERNS[platform].test(name)
}

function assetMatchesArch(name: string, arch: Arch): boolean {
  if (arch === 'unknown') return true
  // If no arch keywords at all, it's likely universal → match
  const hasAnyArch = /arm64|aarch64|x86.?64|amd64|x64|x86|i[36]86|universal/i.test(name)
  if (!hasAnyArch) return true
  if (/universal/i.test(name)) return true
  return ARCH_PATTERNS[arch].test(name)
}

export function classifyAssets(
  assets: readonly GitHubReleaseAsset[],
  platform: Platform,
  arch: Arch,
): {
  matched: GitHubReleaseAsset[]
  other: GitHubReleaseAsset[]
  source: GitHubReleaseAsset[]
} {
  const matched: GitHubReleaseAsset[] = []
  const other: GitHubReleaseAsset[] = []
  const source: GitHubReleaseAsset[] = []

  for (const asset of assets) {
    if (isSourceCode(asset.name)) {
      source.push(asset)
    } else if (assetMatchesPlatform(asset.name, platform) && assetMatchesArch(asset.name, arch)) {
      matched.push(asset)
    } else {
      other.push(asset)
    }
  }

  return { matched, other, source }
}

// ── Composable ──────────────────────────────────────────────

export function useReleases(repoInfo: Ref<RepoInfo | null>) {
  const releases = ref<GitHubRelease[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const hasMore = ref(true)
  const downloadProgress = ref<ReleaseDownloadProgress | null>(null)
  const selectedReleaseIdx = ref(0)
  const showAllPlatforms = ref(false)

  const platform = detectPlatform()
  const arch = detectArch()

  let currentPage = 1
  const PER_PAGE = 20

  const selectedRelease = computed(() => releases.value[selectedReleaseIdx.value] ?? null)

  const classifiedAssets = computed(() => {
    const release = selectedRelease.value
    if (!release) return { matched: [], other: [], source: [] }
    return classifyAssets(release.assets, platform, arch)
  })

  async function fetchReleases(reset = false) {
    const repo = repoInfo.value
    if (!repo) return

    if (reset) {
      currentPage = 1
      releases.value = []
      hasMore.value = true
      selectedReleaseIdx.value = 0
    }

    if (!hasMore.value) return

    loading.value = true
    loadError.value = null

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_RELEASES',
        owner: repo.owner,
        repo: repo.repo,
        page: currentPage,
        perPage: PER_PAGE,
      })

      if (res.error) {
        loadError.value = res.error
        return
      }

      const batch: GitHubRelease[] = res.releases
      const published = batch.filter((r: GitHubRelease) => !r.draft)

      if (reset) {
        releases.value = published
      } else {
        releases.value = [...releases.value, ...published]
      }

      if (batch.length < PER_PAGE) {
        hasMore.value = false
      }

      currentPage++
    } catch (err: any) {
      loadError.value = err.message || 'Failed to fetch releases'
    } finally {
      loading.value = false
    }
  }

  function triggerBrowserDownload(data: ArrayBuffer, fileName: string, mimeType = 'application/octet-stream') {
    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function downloadAsset(asset: GitHubReleaseAsset) {
    downloadProgress.value = {
      assetName: asset.name,
      status: 'downloading',
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_RELEASE_ASSET',
        url: asset.browser_download_url,
        fileName: asset.name,
      })

      if (res.error) {
        downloadProgress.value = {
          assetName: asset.name,
          status: 'error',
          error: res.error,
        }
        clearProgressAfterDelay()
        return
      }

      const data = base64ToBytes(res.base64)
      triggerBrowserDownload(toPlainArrayBuffer(data), asset.name, asset.content_type)

      downloadProgress.value = {
        assetName: asset.name,
        status: 'done',
      }
    } catch (err: any) {
      downloadProgress.value = {
        assetName: asset.name,
        status: 'error',
        error: err.message || 'Download failed',
      }
    }

    clearProgressAfterDelay()
  }

  function clearProgressAfterDelay() {
    setTimeout(() => {
      downloadProgress.value = null
    }, 2500)
  }

  function selectRelease(index: number) {
    selectedReleaseIdx.value = index
  }

  function toggleAllPlatforms() {
    showAllPlatforms.value = !showAllPlatforms.value
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return {
    releases: readonly(releases),
    loading: readonly(loading),
    loadError: readonly(loadError),
    hasMore: readonly(hasMore),
    downloadProgress: readonly(downloadProgress),
    selectedRelease,
    selectedReleaseIdx: readonly(selectedReleaseIdx),
    classifiedAssets,
    showAllPlatforms: readonly(showAllPlatforms),
    platform,
    arch,
    fetchReleases,
    downloadAsset,
    selectRelease,
    toggleAllPlatforms,
    formatFileSize,
    formatDate,
  }
}
