<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTree } from './composables/useTree'
import { useSearch } from './composables/useSearch'
import { useKeyboard } from './composables/useKeyboard'
import { useTheme } from './composables/useTheme'
import { useDownloadFolder } from './composables/useDownloadFolder'
import { useStarCelebration } from './composables/useStarCelebration'
import { useTreeStore } from './stores/tree'
import { ensureSettingsStyles, ensureTreePadStyles, ensureReleaseStyles } from './style-manager'
import { navigateWithTurbo } from './utils/navigation'
import TreePanel from './components/TreePanel.vue'
import TreeHeader from './components/TreeHeader.vue'
import SearchBar from './components/SearchBar.vue'
import FileTree from './components/FileTree.vue'
import ToggleButton from './components/ToggleButton.vue'
import DownloadToast from './components/DownloadToast.vue'
import SettingsView from './components/SettingsView.vue'
import ReleasePanel from './components/ReleasePanel.vue'
import TreePadButton from './components/TreePadButton.vue'
import TreePadDialog from './components/TreePadDialog.vue'
import type { FlatNode } from '../shared/types'

const store = useTreeStore()
const { visibleNodes, repoInfo } = useTree()
const { query, results, isSearching, clear } = useSearch()
const { isDark } = useTheme()
const { progress, download, downloadFile, cancel } = useDownloadFolder()
useStarCelebration()

const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null)
const settingsOpen = ref(false)
const releaseOpen = ref(false)
const chatOpen = ref(false)
const chatRevealSignal = ref(0)

const displayNodes = computed(() => {
  if (isSearching.value) {
    return results.value.map((r) => r.node)
  }
  return visibleNodes.value
})
const canDownloadAll = computed(() => !!repoInfo.value && store.nodes.length > 0)

function handleNodeClick(node: FlatNode) {
  store.selectPath(node.path)
  if (isSearching.value && node.isDir) {
    clear()
  }
  if (!node.isDir) {
    navigateToFile(node.path)
  }
}

function handleDownload(node: FlatNode) {
  if (!repoInfo.value) return
  if (node.isDir) {
    download(store.nodes, node, repoInfo.value)
    return
  }
  downloadFile(node, repoInfo.value)
}

function handleDownloadAll() {
  if (!repoInfo.value || store.nodes.length === 0) return
  download(store.nodes, {
    idx: -1,
    name: repoInfo.value.repo,
    path: '',
    depth: 0,
    isDir: true,
    parentIdx: -1,
    childCount: store.nodes.length,
    subtreeEnd: store.nodes.length,
  }, repoInfo.value)
}

function navigateToFile(path: string) {
  const repo = store.currentRepo
  if (!repo) return
  navigateWithTurbo(`/${repo.owner}/${repo.repo}/blob/${repo.branch}/${path}`)
}

async function toggleSettings() {
  if (!settingsOpen.value) {
    await ensureSettingsStyles()
    releaseOpen.value = false
  }
  settingsOpen.value = !settingsOpen.value
}

async function toggleRelease() {
  if (!releaseOpen.value) {
    await ensureReleaseStyles()
    settingsOpen.value = false
  }
  releaseOpen.value = !releaseOpen.value
}

async function handleTreePadButtonClick() {
  if (!chatOpen.value) {
    await ensureTreePadStyles()
    chatOpen.value = true
    chatRevealSignal.value += 1
    return
  }
  chatRevealSignal.value += 1
}

useKeyboard(
  displayNodes,
  computed(() => fileTreeRef.value?.containerRef ?? null),
  handleNodeClick,
  () => searchBarRef.value?.focus(),
)

const showPanel = computed(() => !!repoInfo.value)
</script>

<template>
  <div :class="{ dark: isDark }">
    <template v-if="showPanel">
      <TreePanel>
        <TreeHeader
          :settings-open="settingsOpen"
          :release-open="releaseOpen"
          :can-download-all="canDownloadAll"
          @toggle-settings="toggleSettings"
          @toggle-release="toggleRelease"
          @download-all="handleDownloadAll"
        />
        <template v-if="settingsOpen">
          <SettingsView />
        </template>
        <template v-else-if="releaseOpen">
          <ReleasePanel
            :repo-info="repoInfo"
            @close="releaseOpen = false"
          />
        </template>
        <template v-else>
          <SearchBar ref="searchBarRef" v-model="query" />
          <FileTree
            ref="fileTreeRef"
            :visible-nodes="displayNodes"
            :search-mode="isSearching"
            @node-click="handleNodeClick"
            @download="handleDownload"
          />
          <DownloadToast
            v-if="progress"
            :progress="progress"
            @cancel="cancel"
          />
        </template>
      </TreePanel>
      <ToggleButton />
      <TreePadButton @click="handleTreePadButtonClick" />
      <TreePadDialog
        v-if="chatOpen"
        :reveal-signal="chatRevealSignal"
        @close="chatOpen = false"
      />
    </template>
  </div>
</template>
