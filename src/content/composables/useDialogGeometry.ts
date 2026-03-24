import { computed, onUnmounted, ref, type Ref } from 'vue'

export type DialogResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface UseDialogGeometryOptions {
  dialogEl: Ref<HTMLElement | null>
  initialWidth?: number
  initialHeight?: number
  onPersistSize: (width: number, height: number) => void
}

const VIEWPORT_MARGIN = 24
const MIN_W = 520
const MIN_H = 420
const DEFAULT_W = 680
const DEFAULT_H = 720
const HEADER_INTERACTIVE_SELECTOR = '.treepad-header-close, .treepad-header-minimize, .treepad-header-reset, .treepad-header-size'

export function useDialogGeometry(options: UseDialogGeometryOptions) {
  const viewportSize = ref({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  })

  function getDialogMaxWidth() {
    return Math.max(320, viewportSize.value.width - VIEWPORT_MARGIN)
  }

  function getDialogMaxHeight() {
    return Math.max(320, viewportSize.value.height - VIEWPORT_MARGIN)
  }

  function getDialogMinWidth() {
    return Math.min(MIN_W, getDialogMaxWidth())
  }

  function getDialogMinHeight() {
    return Math.min(MIN_H, getDialogMaxHeight())
  }

  function getDialogDefaultWidth() {
    return Math.min(DEFAULT_W, getDialogMaxWidth())
  }

  function getDialogDefaultHeight() {
    return Math.min(DEFAULT_H, getDialogMaxHeight())
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Math.round(value)))
  }

  function clampWidth(value: number) {
    return clamp(value, getDialogMinWidth(), getDialogMaxWidth())
  }

  function clampHeight(value: number) {
    return clamp(value, getDialogMinHeight(), getDialogMaxHeight())
  }

  const dlgW = ref(clampWidth(options.initialWidth || getDialogDefaultWidth()))
  const dlgH = ref(clampHeight(options.initialHeight || getDialogDefaultHeight()))
  const dlgX = ref<number | null>(null)
  const dlgY = ref<number | null>(null)
  const interactionActive = ref(false)

  function persistSize() {
    options.onPersistSize(
      clampWidth(dlgW.value),
      clampHeight(dlgH.value),
    )
  }

  function resetSizeAndPosition() {
    dlgW.value = getDialogDefaultWidth()
    dlgH.value = getDialogDefaultHeight()
    dlgX.value = null
    dlgY.value = null
    persistSize()
  }

  function syncDialogBounds(shouldPersist = false) {
    const nextW = clampWidth(dlgW.value || getDialogDefaultWidth())
    const nextH = clampHeight(dlgH.value || getDialogDefaultHeight())
    const changed = nextW !== dlgW.value || nextH !== dlgH.value

    dlgW.value = nextW
    dlgH.value = nextH

    if (changed && shouldPersist) {
      persistSize()
    }
  }

  const dialogStyle = computed(() => {
    const style: Record<string, string> = {
      width: `${dlgW.value}px`,
      height: `${dlgH.value}px`,
    }

    if (dlgX.value !== null && dlgY.value !== null) {
      style.left = `${dlgX.value}px`
      style.top = `${dlgY.value}px`
    }

    return style
  })

  const isPositioned = computed(() => dlgX.value !== null)

  const outsideQuickDockLeft = computed(() => {
    const dockWidth = 78
    if (dlgX.value === null) {
      // Use CSS calc() to match dialog's `left:50%;transform:translateX(-50%)` exactly
      return `max(12px, calc(50% - ${dlgW.value / 2 + dockWidth - 1}px))`
    }
    return `${Math.max(12, dlgX.value - dockWidth + 1)}px`
  })

  const outsideActionDockLeft = computed(() => {
    const dockWidth = 92
    if (dlgX.value === null) {
      // Use CSS calc() so the dock's left edge is exactly at dialog right border - 1px
      return `min(calc(50% + ${dlgW.value / 2 - 1}px), calc(100vw - ${dockWidth + 12}px))`
    }
    const preferredLeft = dlgX.value + dlgW.value - 1
    return `${Math.min(preferredLeft, viewportSize.value.width - dockWidth - 12)}px`
  })

  const outsideActionDockStyle = computed(() => {
    const dockHeight = 138
    const dialogTop = dlgY.value ?? Math.round(viewportSize.value.height - dlgH.value)
    const preferredTop = dialogTop + 48
    const maxTop = Math.max(16, viewportSize.value.height - dockHeight - 16)

    return {
      left: outsideActionDockLeft.value,
      top: `${Math.min(preferredTop, maxTop)}px`,
    }
  })

  const outsideDockStyle = computed(() => {
    const dockHeight = 288
    const dialogTop = dlgY.value ?? Math.round(viewportSize.value.height - dlgH.value)
    const preferredTop = dialogTop + 184
    const maxTop = Math.max(16, viewportSize.value.height - dockHeight - 16)

    return {
      left: outsideQuickDockLeft.value,
      top: `${Math.min(preferredTop, maxTop)}px`,
    }
  })

  let dragStart: { mx: number; my: number; ox: number; oy: number } | null = null
  let resizeStart: {
    mx: number
    my: number
    ow: number
    oh: number
    cx: number
    cy: number
    edge: DialogResizeEdge
    wasPositioned: boolean
  } | null = null

  function clampX(x: number) {
    return Math.max(0, Math.min(x, viewportSize.value.width - 60))
  }

  function clampY(y: number) {
    return Math.max(0, Math.min(y, viewportSize.value.height - 40))
  }

  function syncInteractionActive() {
    interactionActive.value = dragStart !== null || resizeStart !== null
  }

  function onDragMove(e: PointerEvent) {
    if (!dragStart) return
    dlgX.value = clampX(dragStart.ox + e.clientX - dragStart.mx)
    dlgY.value = clampY(dragStart.oy + e.clientY - dragStart.my)
  }

  function onDragEnd() {
    dragStart = null
    syncInteractionActive()
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragEnd)
  }

  function onHeaderPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest(HEADER_INTERACTIVE_SELECTOR)) return
    e.preventDefault()

    const dialog = options.dialogEl.value
    if (!dialog) return

    const rect = dialog.getBoundingClientRect()
    if (dlgX.value === null) {
      dlgX.value = rect.left
      dlgY.value = rect.top
    }

    dragStart = { mx: e.clientX, my: e.clientY, ox: dlgX.value!, oy: dlgY.value! }
    syncInteractionActive()
    document.addEventListener('pointermove', onDragMove)
    document.addEventListener('pointerup', onDragEnd)
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizeStart) return
    const dx = e.clientX - resizeStart.mx
    const dy = e.clientY - resizeStart.my
    const { ow, oh, cx, cy, edge, wasPositioned } = resizeStart

    let newW = ow
    let newH = oh

    if (edge.includes('e')) newW = clampWidth(ow + dx * 2)
    if (edge.includes('w')) newW = clampWidth(ow - dx * 2)
    if (edge.includes('s')) newH = clampHeight(oh + dy * 2)
    if (edge.includes('n')) newH = clampHeight(oh - dy * 2)

    dlgW.value = newW
    dlgH.value = newH

    if (wasPositioned) {
      dlgX.value = clampX(cx - newW / 2)
      dlgY.value = clampY(cy - newH / 2)
    }
  }

  function onResizeEnd() {
    resizeStart = null
    syncInteractionActive()
    document.removeEventListener('pointermove', onResizeMove)
    document.removeEventListener('pointerup', onResizeEnd)
    persistSize()
  }

  function onResizePointerDown(edge: DialogResizeEdge, e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()

    const dialog = options.dialogEl.value
    if (!dialog) return

    const rect = dialog.getBoundingClientRect()
    const wasPositioned = dlgX.value !== null
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    resizeStart = {
      mx: e.clientX,
      my: e.clientY,
      ow: dlgW.value,
      oh: dlgH.value,
      cx,
      cy,
      edge,
      wasPositioned,
    }

    syncInteractionActive()
    document.addEventListener('pointermove', onResizeMove)
    document.addEventListener('pointerup', onResizeEnd)
  }

  function onWindowResize() {
    viewportSize.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
    syncDialogBounds()
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragEnd)
    document.removeEventListener('pointermove', onResizeMove)
    document.removeEventListener('pointerup', onResizeEnd)
  })

  return {
    dialogStyle,
    dlgH,
    dlgW,
    dlgX,
    dlgY,
    interactionActive,
    isPositioned,
    onHeaderPointerDown,
    onResizePointerDown,
    onWindowResize,
    outsideActionDockStyle,
    outsideDockStyle,
    resetSizeAndPosition,
    syncDialogBounds,
    viewportSize,
  }
}
