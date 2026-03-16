import { GITHUB_API_BASE } from './constants'
import type { GitTreeResponse } from './types'

export interface AuthInfo {
  token?: string
  cookie?: string
}

function buildHeaders(auth: AuthInfo): Record<string, string> {
  const h: Record<string, string> = {}
  if (auth.token) {
    h['Authorization'] = `token ${auth.token}`
  } else if (auth.cookie) {
    h['Cookie'] = auth.cookie
  }
  return h
}

function throwApiError(status: number, action: string, hasCookie: boolean): never {
  if (status === 403 && !hasCookie) {
    throw new Error('API rate limit exceeded — set a GitHub token (Settings gear) to raise from 60 to 5,000 req/hr')
  }
  if (status === 403 && hasCookie) {
    throw new Error('API rate limit exceeded (cookie auth may have failed) — try setting a GitHub token (Settings gear)')
  }
  if (status === 401) {
    throw new Error('Invalid GitHub token — please update or remove it (Settings gear)')
  }
  throw new Error(`Failed to ${action}: ${status}`)
}

export async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  auth: AuthInfo = {},
): Promise<GitTreeResponse> {
  const headers = buildHeaders(auth)
  const hasCookie = !!auth.cookie

  // Use commits endpoint — handles branch names with slashes and is more robust than git/ref
  const commitRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { headers },
  )
  if (!commitRes.ok) throwApiError(commitRes.status, 'fetch commit', hasCookie)
  const commitData = await commitRes.json()
  const treeSha = commitData.commit.tree.sha

  const treeRes = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    { headers },
  )
  if (!treeRes.ok) throwApiError(treeRes.status, 'fetch tree', hasCookie)
  return treeRes.json()
}

export async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  auth: AuthInfo = {},
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`
  const res = await fetch(url, { headers: buildHeaders(auth) })
  if (!res.ok) throwApiError(res.status, 'fetch file', !!auth.cookie)
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
    { headers: buildHeaders(auth) },
  )
  if (!res.ok) throwApiError(res.status, 'fetch repo', !!auth.cookie)
  const data = await res.json()
  return data.default_branch
}
