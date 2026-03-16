import { useVirtualizer } from '@tanstack/vue-virtual'
import { type Ref } from 'vue'
import { NODE_HEIGHT } from '../../shared/constants'
import type { FlatNode } from '../../shared/types'

export function useVirtual(
  containerRef: Ref<HTMLElement | null>,
  getItems: () => FlatNode[],
) {
  const virtualizer = useVirtualizer({
    get count() {
      return getItems().length
    },
    getScrollElement: () => containerRef.value,
    estimateSize: () => NODE_HEIGHT,
    overscan: 20,
  })

  return { virtualizer }
}
