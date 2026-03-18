import { useVirtualizer } from '@tanstack/vue-virtual'
import { type Ref } from 'vue'
import { NODE_HEIGHT } from '../../shared/constants'
import type { FlatNode } from '../../shared/types'

export function useVirtual(
  containerRef: Ref<HTMLElement | null>,
  getItems: () => FlatNode[],
  getEstimateSize: () => number = () => NODE_HEIGHT,
) {
  const virtualizer = useVirtualizer({
    get count() {
      return getItems().length
    },
    getScrollElement: () => containerRef.value,
    estimateSize: () => getEstimateSize(),
    overscan: 20,
  })

  return { virtualizer }
}
