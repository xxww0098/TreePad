import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initializeStyles } from './style-manager'

async function mount() {
  if (document.getElementById('treepad-host')) return

  const host = document.createElement('div')
  host.id = 'treepad-host'
  const shadow = host.attachShadow({ mode: 'open' })

  await initializeStyles(shadow)

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
  document.addEventListener('DOMContentLoaded', () => {
    void mount()
  })
} else {
  void mount()
}
