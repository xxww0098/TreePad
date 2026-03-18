<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTreeStore } from '../stores/tree'
import { useVirtual } from '../composables/useVirtual'
import type { FlatNode } from '../../shared/types'
import TreeNode from './TreeNode.vue'
import { NODE_HEIGHT, SEARCH_RESULT_HEIGHT } from '../../shared/constants'

const props = defineProps<{
  visibleNodes: FlatNode[]
  searchMode?: boolean
}>()

const emit = defineEmits<{
  nodeClick: [node: FlatNode]
  download: [node: FlatNode]
}>()

const store = useTreeStore()
const containerRef = ref<HTMLElement | null>(null)
const rowHeight = computed(() => props.searchMode ? SEARCH_RESULT_HEIGHT : NODE_HEIGHT)

const { virtualizer } = useVirtual(
  containerRef,
  () => props.visibleNodes,
  () => rowHeight.value,
)

watch(rowHeight, () => {
  virtualizer.value.measure()
})

function handleNodeClick(node: FlatNode) {
  if (node.isDir) {
    store.toggleExpand(node.idx)
  }
  emit('nodeClick', node)
}

defineExpose({ containerRef })
</script>

<template>
  <div
    ref="containerRef"
    class="file-tree"
    tabindex="0"
    :style="{ '--rt-node-height': `${rowHeight}px` }"
  >
    <div v-if="store.loading" class="tree-loading">
      <div class="spinner" />
    </div>
    <div v-else-if="store.error" class="tree-error">
      {{ store.error }}
    </div>
    <div
      v-else
      :style="{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }"
    >
      <div
        v-for="row in virtualizer.getVirtualItems()"
        :key="visibleNodes[row.index].idx"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${rowHeight}px`,
          transform: `translateY(${row.start}px)`,
        }"
      >
        <TreeNode
          :node="visibleNodes[row.index]"
          :search-mode="!!searchMode"
          @click="handleNodeClick(visibleNodes[row.index])"
          @download="emit('download', $event)"
        />
      </div>
    </div>
  </div>
</template>
