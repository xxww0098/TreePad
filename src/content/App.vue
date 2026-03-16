<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTree } from './composables/useTree'
import { useSearch } from './composables/useSearch'
import { useKeyboard } from './composables/useKeyboard'
import { useTheme } from './composables/useTheme'
import { useDownloadFolder } from './composables/useDownloadFolder'
import { useStarCelebration } from './composables/useStarCelebration'
import { useTreeStore } from './stores/tree'
import TreePanel from './components/TreePanel.vue'
import TreeHeader from './components/TreeHeader.vue'
import SearchBar from './components/SearchBar.vue'
import FileTree from './components/FileTree.vue'
import ToggleButton from './components/ToggleButton.vue'
import DownloadToast from './components/DownloadToast.vue'
import SettingsView from './components/SettingsView.vue'
import TreePadButton from './components/TreePadButton.vue'
import TreePadDialog from './components/TreePadDialog.vue'
import type { FlatNode } from '../shared/types'

const store = useTreeStore()
const { visibleNodes, repoInfo } = useTree()
const { query, results, isSearching } = useSearch()
const { isDark } = useTheme()
const { progress, download, cancel } = useDownloadFolder()
useStarCelebration()

const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)
const fileTreeRef = ref<InstanceType<typeof FileTree> | null>(null)
const settingsOpen = ref(false)
const chatOpen = ref(false)

const displayNodes = computed(() => {
  if (isSearching.value) {
    return results.value.map((r) => r.node)
  }
  return visibleNodes.value
})

function handleNodeClick(node: FlatNode) {
  store.selectPath(node.path)
  if (!node.isDir) {
    navigateToFile(node.path)
  }
}

function handleDownload(node: FlatNode) {
  if (!repoInfo.value) return
  download(store.nodes, node, repoInfo.value)
}

function navigateToFile(path: string) {
  const repo = store.currentRepo
  if (!repo) return
  const url = `/${repo.owner}/${repo.repo}/blob/${repo.branch}/${path}`

  const Turbo = (window as any).Turbo
  if (Turbo?.visit) {
    Turbo.visit(url)
    return
  }

  const a = document.createElement('a')
  a.href = url
  a.dataset.turbo = 'true'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
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
        <TreeHeader :settings-open="settingsOpen" @toggle-settings="toggleSettings" />
        <template v-if="settingsOpen">
          <SettingsView />
        </template>
        <template v-else>
          <SearchBar ref="searchBarRef" v-model="query" />
          <FileTree
            ref="fileTreeRef"
            :visible-nodes="displayNodes"
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
      <TreePadButton @click="chatOpen = true" />
      <TreePadDialog v-if="chatOpen" @close="chatOpen = false" />
    </template>
  </div>
</template>
