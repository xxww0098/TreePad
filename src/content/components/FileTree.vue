<script setup lang="ts">
import { ref } from 'vue'
import { useTreeStore } from '../stores/tree'
import { useVirtual } from '../composables/useVirtual'
import type { FlatNode } from '../../shared/types'
import TreeNode from './TreeNode.vue'
import { NODE_HEIGHT } from '../../shared/constants'

const props = defineProps<{
  visibleNodes: FlatNode[]
}>()

const emit = defineEmits<{
  nodeClick: [node: FlatNode]
  download: [node: FlatNode]
}>()

const store = useTreeStore()
const containerRef = ref<HTMLElement | null>(null)

const { virtualizer } = useVirtual(
  containerRef,
  () => props.visibleNodes,
)

function handleNodeClick(node: FlatNode) {
  if (node.isDir) {
    store.toggleExpand(node.idx)
  }
  emit('nodeClick', node)
}

defineExpose({ containerRef })
</script>

<template>
  <div ref="containerRef" class="file-tree" tabindex="0">
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
          height: `${NODE_HEIGHT}px`,
          transform: `translateY(${row.start}px)`,
        }"
      >
        <TreeNode
          :node="visibleNodes[row.index]"
          @click="handleNodeClick(visibleNodes[row.index])"
          @download="emit('download', $event)"
        />
      </div>
    </div>
  </div>
</template>
