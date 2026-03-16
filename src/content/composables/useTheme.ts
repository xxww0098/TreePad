import { ref, onMounted, onUnmounted } from 'vue'

export function useTheme() {
  const isDark = ref(false)

  function detect() {
    // GitHub uses data-color-mode attribute on <html>
    const html = document.documentElement
    const colorMode = html.getAttribute('data-color-mode')
    const darkAttr = html.getAttribute('data-dark-theme')

    if (colorMode === 'dark') {
      isDark.value = true
    } else if (colorMode === 'auto') {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      // Check if a dark theme is explicitly set
      isDark.value = !!darkAttr && colorMode !== 'light'
    }
  }

  let observer: MutationObserver | null = null

  onMounted(() => {
    detect()

    // Watch for theme changes
    observer = new MutationObserver(detect)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'data-dark-theme', 'data-light-theme'],
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { isDark }
}
