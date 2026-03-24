<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useReleases } from '../composables/useReleases'
import { useI18n } from '../composables/useI18n'
import type { RepoInfo, GitHubReleaseAsset } from '../../shared/types'

const { t } = useI18n()

const props = defineProps<{
  repoInfo: RepoInfo | null
}>()

const emit = defineEmits<{
  close: []
}>()

const repoInfoRef = ref(props.repoInfo)
watch(() => props.repoInfo, (v) => { repoInfoRef.value = v })

const {
  releases,
  loading,
  loadError,
  hasMore,
  downloadProgress,
  selectedRelease,
  selectedReleaseIdx,
  classifiedAssets,
  showAllPlatforms,
  platform,
  fetchReleases,
  downloadAsset,
  selectRelease,
  toggleAllPlatforms,
  formatFileSize,
  formatDate,
} = useReleases(repoInfoRef)

const versionOpen = ref(false)

onMounted(() => {
  fetchReleases(true)
})

watch(() => props.repoInfo?.repo, () => {
  fetchReleases(true)
})

function handleDownload(asset: GitHubReleaseAsset) {
  downloadAsset(asset)
}

function handleVersionSelect(idx: number) {
  selectRelease(idx)
  versionOpen.value = false
}

function platformLabel(p: string): string {
  const labels: Record<string, string> = { mac: 'macOS', win: 'Windows', linux: 'Linux' }
  return labels[p] ?? p
}

function fileIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.endsWith('.dmg') || n.endsWith('.pkg')) return '🍎'
  if (n.endsWith('.exe') || n.endsWith('.msi')) return '🪟'
  if (n.endsWith('.deb') || n.endsWith('.rpm') || n.endsWith('.appimage')) return '🐧'
  if (n.endsWith('.zip') || n.endsWith('.tar.gz') || n.endsWith('.tgz')) return '📦'
  return '📄'
}
</script>

<template>
  <div class="release-panel">
    <!-- Header -->
    <div class="rp-header">
      <div class="rp-header-left">
        <svg class="rp-tag-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.752 1.752 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25zM6 5a1 1 0 110 2 1 1 0 010-2z" />
        </svg>
        <span class="rp-title">{{ t('release.title') }}</span>
      </div>
      <button type="button" class="rp-close-btn" :title="t('header.close')" @click="emit('close')">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading && releases.length === 0" class="rp-state">
      <div class="rp-spinner" />
      <span class="rp-state-text">{{ t('release.loading') }}</span>
    </div>

    <!-- Error -->
    <div v-else-if="loadError && releases.length === 0" class="rp-state">
      <span class="rp-error-text">{{ loadError }}</span>
      <button type="button" class="rp-action-btn" @click="fetchReleases(true)">{{ t('release.retry') }}</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && releases.length === 0" class="rp-state">
      <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" class="rp-empty-icon">
        <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.752 1.752 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25zM6 5a1 1 0 110 2 1 1 0 010-2z" />
      </svg>
      <span class="rp-state-text">{{ t('release.empty') }}</span>
    </div>

    <!-- Content -->
    <template v-else-if="selectedRelease">
      <!-- Version selector -->
      <div class="rp-version-row">
        <button
          type="button"
          class="rp-version-btn"
          @click="versionOpen = !versionOpen"
        >
          <span class="rp-version-label">{{ selectedRelease.tag_name }}</span>
          <span v-if="selectedRelease.prerelease" class="rp-pre-badge">{{ t('release.prerelease') }}</span>
          <svg
            class="rp-chevron"
            :class="{ open: versionOpen }"
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path d="M12.5 5 8 9.5 3.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span v-if="selectedRelease.published_at" class="rp-date">{{ formatDate(selectedRelease.published_at) }}</span>
      </div>

      <!-- Version dropdown -->
      <div v-if="versionOpen" class="rp-version-dropdown">
        <button
          v-for="(r, idx) in releases"
          :key="r.id"
          type="button"
          class="rp-version-option"
          :class="{ active: idx === selectedReleaseIdx }"
          @click="handleVersionSelect(idx)"
        >
          <span class="rp-vo-tag">{{ r.tag_name }}</span>
          <span v-if="r.prerelease" class="rp-pre-badge rp-pre-badge-sm">pre</span>
          <span class="rp-vo-date">{{ formatDate(r.published_at) }}</span>
        </button>
        <button
          v-if="hasMore"
          type="button"
          class="rp-version-option rp-load-more-option"
          :disabled="loading"
          @click="fetchReleases()"
        >
          <template v-if="loading">
            <div class="rp-spinner rp-spinner-sm" />
          </template>
          <template v-else>
            {{ t('release.loadMore') }}
          </template>
        </button>
      </div>

      <!-- Assets section -->
      <div v-if="!versionOpen" class="rp-assets-section">
        <!-- Platform-matched assets -->
        <template v-if="classifiedAssets.matched.length > 0 && !showAllPlatforms">
          <div class="rp-section-label">
            <span>{{ t('release.forYourPlatform') }}</span>
            <span class="rp-platform-chip">{{ platformLabel(platform) }}</span>
          </div>
          <div class="rp-asset-list">
            <div v-for="asset in classifiedAssets.matched" :key="asset.id" class="rp-asset">
              <div class="rp-asset-main">
                <span class="rp-asset-emoji">{{ fileIcon(asset.name) }}</span>
                <div class="rp-asset-meta">
                  <span class="rp-asset-name" :title="asset.name">{{ asset.name }}</span>
                  <span class="rp-asset-size">{{ formatFileSize(asset.size) }}</span>
                </div>
              </div>
              <button
                type="button"
                class="rp-dl-btn"
                :disabled="downloadProgress?.status === 'downloading'"
                @click="handleDownload(asset)"
              >
                <svg
                  v-if="downloadProgress?.assetName === asset.name && downloadProgress?.status === 'downloading'"
                  class="rp-dl-spinner"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                >
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22 12" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.75 13.5A1.25 1.25 0 0 1 1.5 12.25V10a.75.75 0 0 1 1.5 0v2.25h10V10a.75.75 0 0 1 1.5 0v2.25a1.25 1.25 0 0 1-1.25 1.25Z" />
                  <path d="M7.25 2a.75.75 0 0 1 1.5 0v6.19l1.72-1.72a.75.75 0 0 1 1.06 1.06L8.53 10.56a.75.75 0 0 1-1.06 0L4.47 7.53a.75.75 0 1 1 1.06-1.06l1.72 1.72Z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Toggle for all platforms -->
          <button type="button" class="rp-toggle-platforms" @click="toggleAllPlatforms">
            {{ t('release.showAll') }}
            <span class="rp-other-count" v-if="classifiedAssets.other.length > 0">+{{ classifiedAssets.other.length + classifiedAssets.source.length }}</span>
          </button>
        </template>

        <!-- All platforms view (or when no matched assets) -->
        <template v-if="showAllPlatforms || classifiedAssets.matched.length === 0">
          <div class="rp-section-label" v-if="showAllPlatforms && classifiedAssets.matched.length > 0">
            <span>{{ t('release.allPlatforms') }}</span>
            <button type="button" class="rp-toggle-back" @click="toggleAllPlatforms">
              {{ t('release.showMatched') }}
            </button>
          </div>

          <div class="rp-asset-list">
            <div v-for="asset in [...classifiedAssets.matched, ...classifiedAssets.other]" :key="asset.id" class="rp-asset">
              <div class="rp-asset-main">
                <span class="rp-asset-emoji">{{ fileIcon(asset.name) }}</span>
                <div class="rp-asset-meta">
                  <span class="rp-asset-name" :title="asset.name">{{ asset.name }}</span>
                  <span class="rp-asset-size">{{ formatFileSize(asset.size) }}</span>
                </div>
              </div>
              <button
                type="button"
                class="rp-dl-btn"
                :disabled="downloadProgress?.status === 'downloading'"
                @click="handleDownload(asset)"
              >
                <svg
                  v-if="downloadProgress?.assetName === asset.name && downloadProgress?.status === 'downloading'"
                  class="rp-dl-spinner"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                >
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22 12" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.75 13.5A1.25 1.25 0 0 1 1.5 12.25V10a.75.75 0 0 1 1.5 0v2.25h10V10a.75.75 0 0 1 1.5 0v2.25a1.25 1.25 0 0 1-1.25 1.25Z" />
                  <path d="M7.25 2a.75.75 0 0 1 1.5 0v6.19l1.72-1.72a.75.75 0 0 1 1.06 1.06L8.53 10.56a.75.75 0 0 1-1.06 0L4.47 7.53a.75.75 0 1 1 1.06-1.06l1.72 1.72Z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Source code section -->
          <template v-if="classifiedAssets.source.length > 0">
            <div class="rp-section-label rp-section-label-muted">
              <span>{{ t('release.source') }}</span>
            </div>
            <div class="rp-asset-list">
              <div v-for="asset in classifiedAssets.source" :key="asset.id" class="rp-asset rp-asset-muted">
                <div class="rp-asset-main">
                  <span class="rp-asset-emoji">📝</span>
                  <div class="rp-asset-meta">
                    <span class="rp-asset-name" :title="asset.name">{{ asset.name }}</span>
                    <span class="rp-asset-size">{{ formatFileSize(asset.size) }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="rp-dl-btn rp-dl-btn-muted"
                  :disabled="downloadProgress?.status === 'downloading'"
                  @click="handleDownload(asset)"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.75 13.5A1.25 1.25 0 0 1 1.5 12.25V10a.75.75 0 0 1 1.5 0v2.25h10V10a.75.75 0 0 1 1.5 0v2.25a1.25 1.25 0 0 1-1.25 1.25Z" />
                    <path d="M7.25 2a.75.75 0 0 1 1.5 0v6.19l1.72-1.72a.75.75 0 0 1 1.06 1.06L8.53 10.56a.75.75 0 0 1-1.06 0L4.47 7.53a.75.75 0 1 1 1.06-1.06l1.72 1.72Z" />
                  </svg>
                </button>
              </div>
            </div>
          </template>
        </template>

        <!-- No assets at all -->
        <div v-if="selectedRelease.assets.length === 0" class="rp-no-assets">
          {{ t('release.noAssets') }}
        </div>
      </div>
    </template>

    <!-- Download toast -->
    <Transition name="rp-toast">
      <div
        v-if="downloadProgress"
        class="rp-toast"
        :class="{
          'rp-toast-done': downloadProgress.status === 'done',
          'rp-toast-error': downloadProgress.status === 'error',
        }"
      >
        <span class="rp-toast-name">{{ downloadProgress.assetName }}</span>
        <span class="rp-toast-status">
          {{
            downloadProgress.status === 'downloading'
              ? t('release.downloading')
              : downloadProgress.status === 'done'
                ? t('release.downloadDone')
                : downloadProgress.error || t('release.downloadError')
          }}
        </span>
      </div>
    </Transition>
  </div>
</template>
