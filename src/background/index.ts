import { fetchTree, fetchDefaultBranch, fetchRawFile, type AuthInfo } from '../shared/github-api'
import { getCachedTree, setCachedTree } from '../shared/cache'
import { buildFlatNodes } from '../shared/tree-builder'
import type { MessageType, FlatNode } from '../shared/types'

// ── Encrypted token storage ─────────────────────────────────

const TOKEN_KEY = 'github_token_enc'
const AI_KEY_KEY = 'ai_api_key_enc'

async function getDerivedKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(chrome.runtime.id)
  const base = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('treepad-salt'), iterations: 100000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptToken(token: string): Promise<string> {
  const key = await getDerivedKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  const buf = new Uint8Array(iv.length + new Uint8Array(enc).length)
  buf.set(iv)
  buf.set(new Uint8Array(enc), iv.length)
  return btoa(String.fromCharCode(...buf))
}

async function decryptToken(stored: string): Promise<string> {
  const key = await getDerivedKey()
  const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
  const iv = buf.slice(0, 12)
  const data = buf.slice(12)
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(dec)
}

async function getStoredToken(): Promise<string | undefined> {
  const data = await chrome.storage.local.get(TOKEN_KEY)
  const val = data[TOKEN_KEY]
  if (typeof val !== 'string') return undefined
  try {
    return await decryptToken(val)
  } catch {
    return undefined
  }
}

async function setStoredToken(token: string): Promise<void> {
  if (!token.trim()) {
    await chrome.storage.local.remove(TOKEN_KEY)
    return
  }
  const encrypted = await encryptToken(token.trim())
  await chrome.storage.local.set({ [TOKEN_KEY]: encrypted })
}

// ── GitHub session cookie ───────────────────────────────────

async function getGitHubCookie(): Promise<string | undefined> {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.github.com' })
    if (cookies.length === 0) return undefined

    const relevant = cookies.filter((c) =>
      c.name === 'user_session' ||
      c.name === '__Host-user_session_same_site' ||
      c.name === 'logged_in' ||
      c.name === '_gh_sess',
    )
    if (relevant.length === 0) return undefined
    return relevant.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return undefined
  }
}

// ── Auth resolution: cookie → token → none ──────────────────

async function resolveAuth(): Promise<AuthInfo> {
  // 1. Try stored encrypted token (explicit user config takes priority)
  const token = await getStoredToken()
  if (token) return { token }

  // 2. Try cookie (zero-config for logged-in users)
  const cookie = await getGitHubCookie()
  if (cookie) return { cookie }

  // 3. No auth
  return {}
}

// ── Message handlers ────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === 'FETCH_TREE') {
    handleFetchTree(message.owner, message.repo, message.branch)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.type === 'FETCH_RAW') {
    resolveAuth()
      .then((auth) => fetchRawFile(message.owner, message.repo, message.branch, message.path, auth))
      .then((base64) => sendResponse({ base64 }))
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.type === 'FETCH_BRANCHES') {
    resolveAuth()
      .then((auth) => fetchDefaultBranch(message.owner, message.repo, auth))
      .then((branch) => sendResponse({ branch }))
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.type === 'SET_TOKEN') {
    setStoredToken(message.token).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'GET_TOKEN') {
    getStoredToken().then((token) => sendResponse({ token: token ? '••••' : '' }))
    return true
  }

  if (message.type === 'SET_AI_KEY') {
    handleSetAiKey(message.key).then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'GET_AI_KEY') {
    getStoredAiKey().then((key) => sendResponse({ key: key ? '••••' : '' }))
    return true
  }

  if (message.type === 'AI_CHAT') {
    handleAiChat(message.baseUrl, message.model, message.messages)
      .then((content) => sendResponse({ content }))
      .catch((err) => sendResponse({ error: err.message }))
    return true
  }
})

// ── AI Key storage ─────────────────────────────────────────

async function getStoredAiKey(): Promise<string | undefined> {
  const data = await chrome.storage.local.get(AI_KEY_KEY)
  const val = data[AI_KEY_KEY]
  if (typeof val !== 'string') return undefined
  try {
    return await decryptToken(val)
  } catch {
    return undefined
  }
}

async function handleSetAiKey(key: string): Promise<void> {
  if (!key.trim()) {
    await chrome.storage.local.remove(AI_KEY_KEY)
    return
  }
  const encrypted = await encryptToken(key.trim())
  await chrome.storage.local.set({ [AI_KEY_KEY]: encrypted })
}

async function handleAiChat(
  baseUrl: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const apiKey = await getStoredAiKey()
  if (!apiKey) throw new Error('AI API key not configured')

  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Streaming AI chat via ports ─────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'AI_CHAT_STREAM') return

    try {
      const apiKey = await getStoredAiKey()
      if (!apiKey) {
        port.postMessage({ type: 'error', error: 'AI API key not configured' })
        return
      }

      const url = msg.baseUrl.replace(/\/+$/, '') + '/chat/completions'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: msg.model, messages: msg.messages, stream: true }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        port.postMessage({ type: 'error', error: `AI API error ${res.status}: ${text.slice(0, 200)}` })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              port.postMessage({ type: 'chunk', content: delta })
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }

      port.postMessage({ type: 'done' })
    } catch (err: any) {
      port.postMessage({ type: 'error', error: err.message || 'Stream failed' })
    }
  })
})

// ── Tree fetch ─────────────────────────────────────────────

async function handleFetchTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ nodes: FlatNode[]; truncated: boolean } | { error: string }> {
  const cached = await getCachedTree(owner, repo, branch)
  if (cached) {
    return { nodes: cached, truncated: false }
  }

  const auth = await resolveAuth()
  const response = await fetchTree(owner, repo, branch, auth)
  const nodes = buildFlatNodes(response.tree)
  await setCachedTree(owner, repo, branch, response.sha, nodes)

  return { nodes, truncated: response.truncated }
}
