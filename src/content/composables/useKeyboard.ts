import { onMounted, onUnmounted, type Ref } from 'vue'
import { useTreeStore } from '../stores/tree'
import type { FlatNode } from '../../shared/types'

export function useKeyboard(
  visibleNodes: Ref<FlatNode[]>,
  containerRef: Ref<HTMLElement | null>,
  onOpen: (node: FlatNode) => void,
  onSearchFocus: () => void,
) {
  const store = useTreeStore()
  let focusIdx = 0

  function findSelectedIdx(): number {
    const idx = visibleNodes.value.findIndex(
      (n) => n.path === store.selectedPath,
    )
    return idx >= 0 ? idx : 0
  }

  function scrollToIdx(idx: number) {
    const el = containerRef.value?.querySelector(
      `[data-idx="${visibleNodes.value[idx]?.idx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Cmd/Ctrl+P for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      onSearchFocus()
      return
    }

    // Only handle nav keys when panel is focused, but not when typing in an input
    const panel = containerRef.value?.closest('#treepad-app')
    if (!panel?.contains(document.activeElement) && document.activeElement !== panel) {
      return
    }
    const tag = (document.activeElement as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      return
    }

    const nodes = visibleNodes.value
    if (!nodes.length) return

    focusIdx = findSelectedIdx()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusIdx = Math.min(focusIdx + 1, nodes.length - 1)
        store.selectPath(nodes[focusIdx].path)
        scrollToIdx(focusIdx)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusIdx = Math.max(focusIdx - 1, 0)
        store.selectPath(nodes[focusIdx].path)
        scrollToIdx(focusIdx)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (nodes[focusIdx]?.isDir && !store.expandedIds.has(nodes[focusIdx].idx)) {
          store.toggleExpand(nodes[focusIdx].idx)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (nodes[focusIdx]?.isDir && store.expandedIds.has(nodes[focusIdx].idx)) {
          store.toggleExpand(nodes[focusIdx].idx)
        }
        break
      case 'Enter':
        e.preventDefault()
        if (nodes[focusIdx]) {
          onOpen(nodes[focusIdx])
        }
        break
      case ' ':
        e.preventDefault()
        if (nodes[focusIdx]?.isDir) {
          store.toggleExpand(nodes[focusIdx].idx)
        }
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}
