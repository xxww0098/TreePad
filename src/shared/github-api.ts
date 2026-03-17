import { GITHUB_API_BASE } from './constants'
import type {
  GitTreeResponse,
  GitHubAuthMode,
  GitHubRateLimitInfo,
  GitHubTokenSource,
} from './types'

export interface AuthInfo {
  token?: string
  tokenSource?: GitHubTokenSource
  useCookieAuth?: boolean
}

export class GitHubApiError extends Error {
  status: number
  rateLimit: GitHubRateLimitInfo | null

  constructor(message: string, status: number, rateLimit: GitHubRateLimitInfo | null = null) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.rateLimit = rateLimit
  }
}

function buildHeaders(auth: AuthInfo): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  }
  if (auth.token) {
    h.Authorization = `Bearer ${auth.token}`
  }
  return h
}

export function getAuthMode(auth: AuthInfo): GitHubAuthMode {
  if (auth.token) return 'token'
  if (auth.useCookieAuth) return 'cookie'
  return 'none'
}

function buildRequestInit(
  auth: AuthInfo,
  init: RequestInit = {},
): RequestInit {
  const extraHeaders = init.headers
    ? Object.fromEntries(new Headers(init.headers).entries())
    : {}

  return {
    ...init,
    credentials: auth.useCookieAuth ? 'include' : 'omit',
    headers: {
      ...buildHeaders(auth),
      ...extraHeaders,
    },
  }
}

function parseHeaderNumber(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toResetTimestamp(resetSeconds: number | null): number | null {
  return resetSeconds === null ? null : resetSeconds * 1000
}

function readRateLimitInfo(
  headers: Headers,
  requestedAuthMode: GitHubAuthMode,
): GitHubRateLimitInfo | null {
  const limit = parseHeaderNumber(headers.get('x-ratelimit-limit'))
  const remaining = parseHeaderNumber(headers.get('x-ratelimit-remaining'))
  const used = parseHeaderNumber(headers.get('x-ratelimit-used'))
  const resetAt = toResetTimestamp(parseHeaderNumber(headers.get('x-ratelimit-reset')))
  const resource = headers.get('x-ratelimit-resource')

  if (
    limit === null &&
    remaining === null &&
    used === null &&
    resetAt === null &&
    !resource
  ) {
    return null
  }

  const detectedAsUnauthenticated =
    requestedAuthMode !== 'none' &&
    limit !== null &&
    limit <= 60

  return {
    limit,
    remaining,
    used,
    resetAt,
    resource,
    authMode: requestedAuthMode,
    detectedAsUnauthenticated,
  }
}

function formatResetHint(rateLimit: GitHubRateLimitInfo | null): string {
  if (!rateLimit?.resetAt) return ''
  const time = new Date(rateLimit.resetAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return ` Resets around ${time}.`
}

export function buildRateLimitMessage(
  authMode: GitHubAuthMode,
  rateLimit: GitHubRateLimitInfo | null,
): string {
  const resetHint = formatResetHint(rateLimit)

  if (authMode === 'token') {
    return `This GitHub token has used up its API quota.${resetHint}`
  }

  if (authMode === 'cookie') {
    if (rateLimit?.detectedAsUnauthenticated) {
      return `You are signed into GitHub in the browser, but API requests are still anonymous. Connect with OAuth or a token in Settings.${resetHint}`
    }
    return `Your current GitHub browser session has used up its API quota. Connect GitHub with OAuth or a token in Settings.${resetHint}`
  }

  return `GitHub API quota is used up. Connect GitHub in Settings to raise the limit from 60 to 5,000 requests per hour.${resetHint}`
}

async function readGitHubErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.clone().text()
    try {
      const data = JSON.parse(text)
      if (typeof data?.message === 'string') return data.message
    } catch {
      // Not JSON — fall through to raw text.
    }
    return text.trim()
  } catch {
    return ''
  }
}

async function throwApiError(
  res: Response,
  action: string,
  auth: AuthInfo,
): Promise<never> {
  const authMode = getAuthMode(auth)
  const rateLimit = readRateLimitInfo(res.headers, authMode)
  const apiMessage = await readGitHubErrorMessage(res)
  const lowerMessage = apiMessage.toLowerCase()

  if (res.status === 401 && authMode === 'token') {
    throw new GitHubApiError(
      'This GitHub token is invalid. Update it or remove it in Settings.',
      res.status,
      rateLimit,
    )
  }

  const isRateLimited =
    res.status === 429 ||
    lowerMessage.includes('rate limit') ||
    (res.status === 403 && (rateLimit?.remaining === 0 || lowerMessage.includes('abuse')))
  if (isRateLimited) {
    throw new GitHubApiError(
      buildRateLimitMessage(authMode, rateLimit),
      res.status,
      rateLimit,
    )
  }

  if (res.status === 403) {
    const suffix = apiMessage ? ` — ${apiMessage}` : ''
    throw new GitHubApiError(
      `Access denied${suffix}`,
      res.status,
      rateLimit,
    )
  }

  if (res.status === 401 && authMode === 'cookie') {
    throw new GitHubApiError(
      'TreePad could not use your current GitHub browser session for API requests. Refresh GitHub, or connect with OAuth or a token in Settings.',
      res.status,
      rateLimit,
    )
  }

  if (res.status === 401) {
    throw new GitHubApiError(
      'GitHub connection required. Connect GitHub in Settings.',
      res.status,
      rateLimit,
    )
  }

  if (res.status === 404 && authMode === 'token') {
    throw new GitHubApiError(
      'This repo or file could not be found. If it is private, make sure the connected GitHub account can access it.',
      res.status,
      rateLimit,
    )
  }

  const suffix = apiMessage ? ` — ${apiMessage}` : ''
  throw new GitHubApiError(
    `Failed to ${action}: ${res.status}${suffix}`,
    res.status,
    rateLimit,
  )
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function parseJsonNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function fetchRateLimit(
  auth: AuthInfo = {},
): Promise<GitHubRateLimitInfo> {
  const requestedAuthMode = getAuthMode(auth)
  const res = await fetch(
    `${GITHUB_API_BASE}/rate_limit`,
    buildRequestInit(auth),
  )

  if (!res.ok) {
    await throwApiError(res, 'fetch rate limit', auth)
  }

  const headerInfo = readRateLimitInfo(res.headers, requestedAuthMode)
  const data = await res.json()
  const core = data?.resources?.core ?? {}
  const limit = parseJsonNumber(core.limit) ?? headerInfo?.limit ?? null
  const remaining = parseJsonNumber(core.remaining) ?? headerInfo?.remaining ?? null
  const used = parseJsonNumber(core.used) ?? headerInfo?.used ?? null
  const resetAt = toResetTimestamp(parseJsonNumber(core.reset)) ?? headerInfo?.resetAt ?? null

  return {
    limit,
    remaining,
    used,
    resetAt,
    resource: 'core',
    authMode: requestedAuthMode,
    detectedAsUnauthenticated:
      requestedAuthMode !== 'none' &&
      limit !== null &&
      limit <= 60,
  }
}

export async function validateToken(
  token: string,
): Promise<GitHubRateLimitInfo> {
  return fetchRateLimit({ token })
}

export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  auth: AuthInfo = {},
): Promise<GitTreeResponse> {
  // Use commits endpoint — handles branch names with slashes and is more robust than git/ref
  const commitRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    buildRequestInit(auth),
  )
  if (!commitRes.ok) await throwApiError(commitRes, 'fetch commit', auth)
  const commitData = await commitRes.json()
  const treeSha = commitData.commit.tree.sha

  const treeRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    buildRequestInit(auth),
  )
  if (!treeRes.ok) await throwApiError(treeRes, 'fetch tree', auth)
  return treeRes.json()
}

export async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  auth: AuthInfo = {},
): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, buildRequestInit(auth, {
    headers: {
      Accept: 'application/vnd.github.raw',
    },
  }))
  if (!res.ok) await throwApiError(res, 'fetch file', auth)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function fetchDefaultBranch(
  owner: string,
  repo: string,
  auth: AuthInfo = {},
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
    buildRequestInit(auth),
  )
  if (!res.ok) await throwApiError(res, 'fetch repo', auth)
  const data = await res.json()
  return data.default_branch
}
