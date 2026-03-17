import {
  GitHubApiError,
  buildRateLimitMessage,
  fetchTree,
  fetchDefaultBranch,
  fetchRawFile,
  fetchRateLimit,
  getAuthMode,
  validateToken,
  type AuthInfo,
} from '../shared/github-api'
import {
  getCachedDefaultBranch,
  getCachedTree,
  setCachedDefaultBranch,
  setCachedTree,
} from '../shared/cache'
import { buildFlatNodes } from '../shared/tree-builder'
import type {
  MessageType,
  FlatNode,
  GitHubAuthStatus,
  GitHubDeviceCodeInfo,
  GitHubDeviceFlowPollResult,
  GitHubRateLimitInfo,
  GitHubTokenSource,
} from '../shared/types'

// ── Encrypted token storage ─────────────────────────────────

const TOKEN_KEY = 'github_token_enc'
const TOKEN_SOURCE_KEY = 'github_token_source'
const GITHUB_OAUTH_CLIENT_ID_KEY = 'github_oauth_client_id'
const AI_KEY_KEY = 'ai_api_key_enc'
const DEFAULT_GITHUB_OAUTH_CLIENT_ID = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID ?? ''
const DEVICE_FLOW_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const RATE_LIMIT_CACHE_TTL_MS = 15_000

const inflightRequests = new Map<string, Promise<unknown>>()
const rateLimitCache = new Map<string, { info: GitHubRateLimitInfo; fetchedAt: number }>()

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

async function getStoredTokenSource(): Promise<GitHubTokenSource | undefined> {
  const data = await chrome.storage.local.get(TOKEN_SOURCE_KEY)
  const source = data[TOKEN_SOURCE_KEY]
  if (source === 'manual' || source === 'oauth-device') return source
  return undefined
}

async function setStoredToken(
  token: string,
  source: GitHubTokenSource = 'manual',
): Promise<void> {
  if (!token.trim()) {
    await chrome.storage.local.remove([TOKEN_KEY, TOKEN_SOURCE_KEY])
    return
  }
  const encrypted = await encryptToken(token.trim())
  await chrome.storage.local.set({
    [TOKEN_KEY]: encrypted,
    [TOKEN_SOURCE_KEY]: source,
  })
}

async function getStoredGitHubOAuthClientId(): Promise<string> {
  const data = await chrome.storage.local.get(GITHUB_OAUTH_CLIENT_ID_KEY)
  const stored = data[GITHUB_OAUTH_CLIENT_ID_KEY]
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  return DEFAULT_GITHUB_OAUTH_CLIENT_ID.trim()
}

async function setStoredGitHubOAuthClientId(clientId: string): Promise<void> {
  const trimmed = clientId.trim()
  if (!trimmed) {
    await chrome.storage.local.remove(GITHUB_OAUTH_CLIENT_ID_KEY)
    return
  }
  await chrome.storage.local.set({ [GITHUB_OAUTH_CLIENT_ID_KEY]: trimmed })
}

function getAuthCacheKey(auth: AuthInfo): string {
  if (auth.token) return `token:${auth.token.slice(-12)}`
  if (auth.useCookieAuth) return 'cookie'
  return 'none'
}

function rememberRateLimit(auth: AuthInfo, info: GitHubRateLimitInfo) {
  rateLimitCache.set(getAuthCacheKey(auth), {
    info,
    fetchedAt: Date.now(),
  })
}

function getRememberedRateLimit(auth: AuthInfo): GitHubRateLimitInfo | null {
  const cached = rateLimitCache.get(getAuthCacheKey(auth))
  return cached?.info ?? null
}

function isRateLimitFresh(auth: AuthInfo): boolean {
  const cached = rateLimitCache.get(getAuthCacheKey(auth))
  if (!cached) return false
  if (Date.now() - cached.fetchedAt < RATE_LIMIT_CACHE_TTL_MS) return true
  return (
    cached.info.remaining === 0 &&
    !!cached.info.resetAt &&
    cached.info.resetAt > Date.now()
  )
}

async function ensureRateLimitAvailable(auth: AuthInfo): Promise<void> {
  if (!isRateLimitFresh(auth)) return

  const cached = rateLimitCache.get(getAuthCacheKey(auth))
  if (cached && cached.info.remaining === 0 && cached.info.resetAt && cached.info.resetAt > Date.now()) {
    throw new Error(buildRateLimitMessage(cached.info.authMode, cached.info))
  }
}

function withInflight<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = inflightRequests.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = loader().finally(() => {
    inflightRequests.delete(key)
  })
  inflightRequests.set(key, promise)
  return promise
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Unknown error'
}

async function rememberRateLimitFromError(auth: AuthInfo, err: unknown) {
  if (err instanceof GitHubApiError && err.rateLimit) {
    rememberRateLimit(auth, err.rateLimit)
    return
  }

  if (isRateLimitFresh(auth)) return

  try {
    const info = await fetchRateLimit(auth)
    rememberRateLimit(auth, info)
  } catch {
    // Best effort only.
  }
}

// ── GitHub session cookie ───────────────────────────────────

async function hasGitHubSession(): Promise<boolean> {
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.github.com' })
    if (cookies.length === 0) return false

    const relevant = cookies.filter((c) =>
      c.name === 'user_session' ||
      c.name === '__Host-user_session_same_site' ||
      c.name === 'logged_in' ||
      c.name === '_gh_sess',
    )
    return relevant.some((c) => !!c.value)
  } catch {
    return false
  }
}

// ── Auth resolution: token → browser-managed GitHub session → none ──

async function resolveAuth(): Promise<AuthInfo> {
  const token = await getStoredToken()
  if (token) {
    return {
      token,
      tokenSource: await getStoredTokenSource(),
    }
  }

  const hasSession = await hasGitHubSession()
  if (hasSession) return { useCookieAuth: true }

  return {}
}

async function getGitHubAuthStatus(force = false): Promise<GitHubAuthStatus> {
  const auth = await resolveAuth()
  const oauthClientId = await getStoredGitHubOAuthClientId()
  const hasToken = !!auth.token
  const tokenSource = hasToken ? auth.tokenSource ?? 'manual' : null
  let rateLimit = getRememberedRateLimit(auth)

  if (force || !rateLimit || !isRateLimitFresh(auth)) {
    try {
      rateLimit = await fetchRateLimit(auth)
      rememberRateLimit(auth, rateLimit)
    } catch (err) {
      if (err instanceof GitHubApiError && err.rateLimit) {
        rateLimit = err.rateLimit
        rememberRateLimit(auth, err.rateLimit)
      }
    }
  }

  return {
    authMode: getAuthMode(auth),
    tokenSource,
    hasToken,
    rateLimit: rateLimit ?? null,
    oauthClientId,
  }
}

async function handleSetToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) {
    await setStoredToken('', 'manual')
    return
  }

  const rateLimit = await validateToken(trimmed)
  rememberRateLimit({ token: trimmed, tokenSource: 'manual' }, rateLimit)
  await setStoredToken(trimmed, 'manual')
}

async function resolveOAuthClientId(clientId?: string): Promise<string> {
  const trimmed = clientId?.trim()
  if (trimmed) {
    await setStoredGitHubOAuthClientId(trimmed)
    return trimmed
  }

  const stored = await getStoredGitHubOAuthClientId()
  if (stored) return stored

  throw new Error('GitHub OAuth is not configured for this build yet. Use the token flow, or add a client ID in advanced settings.')
}

async function readOAuthJson(res: Response): Promise<any> {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

async function requestGitHubDeviceCode(clientId: string): Promise<GitHubDeviceCodeInfo> {
  const body = new URLSearchParams({
    client_id: clientId,
  })

  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await readOAuthJson(res)
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Failed to start GitHub OAuth: ${res.status}`)
  }

  if (
    typeof data.device_code !== 'string' ||
    typeof data.user_code !== 'string' ||
    typeof data.verification_uri !== 'string'
  ) {
    throw new Error('GitHub OAuth did not return a valid device code.')
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 900,
    interval: typeof data.interval === 'number' ? data.interval : 5,
  }
}

async function pollGitHubDeviceToken(
  clientId: string,
  deviceCode: string,
): Promise<GitHubDeviceFlowPollResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: DEVICE_FLOW_GRANT_TYPE,
  })

  const res = await fetch(DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await readOAuthJson(res)

  if (typeof data.access_token === 'string') {
    return {
      status: 'success',
      accessToken: data.access_token,
    }
  }

  if (data.error === 'authorization_pending') {
    return { status: 'pending' }
  }

  if (data.error === 'slow_down') {
    return { status: 'slow_down', interval: 10 }
  }

  if (data.error === 'access_denied') {
    return { status: 'error', error: 'GitHub authorization was denied.' }
  }

  if (data.error === 'expired_token') {
    return { status: 'error', error: 'The GitHub device code expired. Start sign-in again.' }
  }

  const fallback = data.error_description || data.error || `GitHub OAuth failed: ${res.status}`
  return { status: 'error', error: fallback }
}

async function handleStartGitHubDeviceFlow(
  clientId?: string,
): Promise<{ clientId: string; flow: GitHubDeviceCodeInfo }> {
  const resolvedClientId = await resolveOAuthClientId(clientId)
  return {
    clientId: resolvedClientId,
    flow: await requestGitHubDeviceCode(resolvedClientId),
  }
}

async function handlePollGitHubDeviceFlow(
  deviceCode: string,
  clientId?: string,
): Promise<GitHubDeviceFlowPollResult> {
  const resolvedClientId = await resolveOAuthClientId(clientId)
  const result = await pollGitHubDeviceToken(resolvedClientId, deviceCode)

  if (result.status === 'success' && result.accessToken) {
    const rateLimit = await validateToken(result.accessToken)
    rememberRateLimit({ token: result.accessToken, tokenSource: 'oauth-device' }, rateLimit)
    await setStoredToken(result.accessToken, 'oauth-device')
  }

  return result
}

async function withGitHubAuth<T>(
  key: string,
  loader: (auth: AuthInfo) => Promise<T>,
): Promise<T> {
  const auth = await resolveAuth()
  await ensureRateLimitAvailable(auth)

  try {
    return await withInflight(key, () => loader(auth))
  } catch (err) {
    await rememberRateLimitFromError(auth, err)
    throw err
  }
}

// ── Message handlers ────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === 'FETCH_TREE') {
    handleFetchTree(message.owner, message.repo, message.branch)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'FETCH_RAW') {
    handleFetchRaw(message.owner, message.repo, message.branch, message.path)
      .then((base64) => sendResponse({ base64 }))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'FETCH_BRANCHES') {
    handleFetchDefaultBranch(message.owner, message.repo)
      .then((branch) => sendResponse({ branch }))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'SET_TOKEN') {
    handleSetToken(message.token)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'GET_TOKEN') {
    Promise.all([getStoredToken(), getStoredTokenSource()])
      .then(([token, source]) => sendResponse({
        token: token ? '••••' : '',
        source: source ?? null,
      }))
    return true
  }

  if (message.type === 'GET_GITHUB_AUTH_STATUS') {
    getGitHubAuthStatus(message.force)
      .then((status) => sendResponse({ status }))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'SET_GITHUB_OAUTH_CLIENT_ID') {
    setStoredGitHubOAuthClientId(message.clientId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'START_GITHUB_DEVICE_FLOW') {
    handleStartGitHubDeviceFlow(message.clientId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
    return true
  }

  if (message.type === 'POLL_GITHUB_DEVICE_FLOW') {
    handlePollGitHubDeviceFlow(message.deviceCode, message.clientId)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
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
      .catch((err) => sendResponse({ error: toErrorMessage(err) }))
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

async function handleFetchDefaultBranch(
  owner: string,
  repo: string,
): Promise<string> {
  const cached = await getCachedDefaultBranch(owner, repo)
  if (cached) return cached

  return withGitHubAuth(`branch:${owner}/${repo}`, async (auth) => {
    const branch = await fetchDefaultBranch(owner, repo, auth)
    await setCachedDefaultBranch(owner, repo, branch)
    return branch
  })
}

async function handleFetchRaw(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string> {
  return withGitHubAuth(`raw:${owner}/${repo}:${branch}:${path}`, (auth) =>
    fetchRawFile(owner, repo, branch, path, auth),
  )
}

async function handleFetchTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ nodes: FlatNode[]; truncated: boolean } | { error: string }> {
  const cached = await getCachedTree(owner, repo, branch)
  if (cached) {
    return { nodes: cached, truncated: false }
  }

  return withGitHubAuth(`tree:${owner}/${repo}:${branch}`, async (auth) => {
    const response = await fetchTree(owner, repo, branch, auth)
    const nodes = buildFlatNodes(response.tree)
    await setCachedTree(owner, repo, branch, response.sha, nodes)

    return { nodes, truncated: response.truncated }
  })
}
