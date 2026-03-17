<script setup lang="ts">
import type { FlatNode } from '../../shared/types'
import { INDENT_SIZE } from '../../shared/constants'
import { useTreeStore } from '../stores/tree'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  node: FlatNode
}>()

const emit = defineEmits<{
  click: [node: FlatNode]
  download: [node: FlatNode]
}>()

const store = useTreeStore()

const isExpanded = () => store.expandedIds.has(props.node.idx)

function onDownloadClick(e: MouseEvent) {
  e.stopPropagation()
  emit('download', props.node)
}
</script>

<template>
  <div
    class="tree-node"
    :class="{
      selected: store.selectedPath === node.path,
      'is-dir': node.isDir,
    }"
    :data-idx="node.idx"
    :style="{ paddingLeft: `${node.depth * INDENT_SIZE + 8}px` }"
    @click="emit('click', node)"
  >
    <!-- 目录行 -->
    <template v-if="node.isDir">
      <span class="tree-node-chevron" :class="{ expanded: isExpanded() }">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3.5 1.5L7.5 5L3.5 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="tree-node-icon dir" :class="{ open: isExpanded() }">
        <!-- 关闭的文件夹 -->
        <svg v-if="!isExpanded()" width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
        </svg>
        <!-- 打开的文件夹 -->
        <svg v-else width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1h6.5c.966 0 1.75.784 1.75 1.75v.5H6.5a2.25 2.25 0 0 0-2.15 1.586l-1.52 4.94A1.75 1.75 0 0 1 1.75 13V2.75c0-.464.184-.91.513-1.237z"/>
          <path d="M5.17 7.348A.75.75 0 0 1 5.862 7h9.167a.75.75 0 0 1 .72.96l-1.286 4.5a.75.75 0 0 1-.72.54H2.487a.75.75 0 0 1-.72-.96l1.684-4.192A.75.75 0 0 1 5.17 7.348z"/>
        </svg>
      </span>
    </template>

    <!-- 文件行 -->
    <template v-else>
      <!-- 占位对齐 chevron -->
      <span class="tree-node-chevron" style="visibility: hidden">
        <svg width="10" height="10"><path/></svg>
      </span>
      <span class="tree-node-icon file">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011z"/>
        </svg>
      </span>
    </template>

    <span class="tree-node-name">{{ node.name }}</span>

    <!-- Download button for directories -->
    <button
      v-if="node.isDir"
      type="button"
      class="tree-node-download"
      :title="t('tree.downloadZip')"
      :aria-label="t('tree.downloadZip')"
      @click="onDownloadClick"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
        <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"/>
      </svg>
    </button>
  </div>
</template>
