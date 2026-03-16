import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import variablesCSS from './styles/variables.css?inline'
import treeCSS from './styles/tree.css?inline'

function mount() {
  if (document.getElementById('treepad-host')) return

  const host = document.createElement('div')
  host.id = 'treepad-host'
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = variablesCSS + '\n' + treeCSS
  shadow.appendChild(style)

  const appRoot = document.createElement('div')
  appRoot.id = 'treepad-app'
  shadow.appendChild(appRoot)

  // Prevent keyboard events from leaking to GitHub's shortcut listeners (t, /, s, etc.)
  appRoot.addEventListener('keydown', (e) => e.stopPropagation())
  appRoot.addEventListener('keypress', (e) => e.stopPropagation())

  document.body.appendChild(host)

  const app = createApp(App)
  app.use(createPinia())
  app.mount(appRoot)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
