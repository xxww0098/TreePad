import variablesCSS from './styles/variables.css?inline'
import coreCSSUrl from './styles/core.css?url'
import settingsCSSUrl from './styles/settings.css?url'
import treePadCSSUrl from './styles/treepad.css?url'
import releaseCSSUrl from './styles/release.css?url'

type StyleKind = 'core' | 'settings' | 'treepad' | 'release'

const STYLE_URLS: Record<StyleKind, string> = {
  core: coreCSSUrl,
  settings: settingsCSSUrl,
  treepad: treePadCSSUrl,
  release: releaseCSSUrl,
}

let activeShadowRoot: ShadowRoot | null = null
const styleTextCache = new Map<StyleKind, Promise<string>>()
const injectedStyles = new Set<StyleKind>()

async function fetchStyleText(kind: StyleKind): Promise<string> {
  const cached = styleTextCache.get(kind)
  if (cached) return cached

  const promise = fetch(chrome.runtime.getURL(STYLE_URLS[kind]))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${kind} stylesheet`)
      }
      return response.text()
    })

  styleTextCache.set(kind, promise)
  return promise
}

async function injectShadowStyle(kind: StyleKind): Promise<void> {
  const shadowRoot = activeShadowRoot
  if (!shadowRoot || injectedStyles.has(kind)) return

  const style = document.createElement('style')
  style.dataset.treepadStyle = kind
  style.textContent = await fetchStyleText(kind)
  shadowRoot.appendChild(style)
  injectedStyles.add(kind)
}

export async function initializeStyles(shadowRoot: ShadowRoot): Promise<void> {
  activeShadowRoot = shadowRoot

  if (shadowRoot.querySelector('style[data-treepad-style="core"]')) {
    injectedStyles.add('core')
    return
  }

  const style = document.createElement('style')
  style.dataset.treepadStyle = 'core'
  style.textContent = `${variablesCSS}\n${await fetchStyleText('core')}`
  shadowRoot.appendChild(style)
  injectedStyles.add('core')
}

export function ensureSettingsStyles(): Promise<void> {
  return injectShadowStyle('settings')
}

export function ensureTreePadStyles(): Promise<void> {
  return injectShadowStyle('treepad')
}

export function ensureReleaseStyles(): Promise<void> {
  return injectShadowStyle('release')
}
