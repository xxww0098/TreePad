/** Raw GitHub API tree entry */
export interface GitTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

/** GitHub API tree response */
export interface GitTreeResponse {
  sha: string
  tree: GitTreeEntry[]
  truncated: boolean
}

/** Flattened tree node with DFS ordering */
export interface FlatNode {
  idx: number
  name: string
  path: string
  depth: number
  isDir: boolean
  parentIdx: number
  childCount: number
  subtreeEnd: number
}

/** Parsed GitHub repo info from URL */
export interface RepoInfo {
  owner: string
  repo: string
  type?: 'tree' | 'blob'
  branch: string
  path: string
  rawRef?: string
}

/** GitHub release asset */
export interface GitHubReleaseAsset {
  id: number
  name: string
  size: number
  browser_download_url: string
  content_type: string
}

/** GitHub release */
export interface GitHubRelease {
  id: number
  tag_name: string
  name: string | null
  prerelease: boolean
  draft: boolean
  published_at: string | null
  readonly assets: GitHubReleaseAsset[]
}

export type GitHubAuthMode = 'none' | 'token' | 'cookie'
export type GitHubTokenSource = 'manual' | 'oauth-device'

export interface GitHubRateLimitInfo {
  limit: number | null
  remaining: number | null
  used: number | null
  resetAt: number | null
  resource: string | null
  authMode: GitHubAuthMode
  detectedAsUnauthenticated: boolean
}

export interface GitHubAuthStatus {
  authMode: GitHubAuthMode
  tokenSource: GitHubTokenSource | null
  hasToken: boolean
  rateLimit: GitHubRateLimitInfo | null
  oauthClientId: string
}

export interface GitHubDeviceCodeInfo {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface GitHubDeviceFlowPollResult {
  status: 'pending' | 'slow_down' | 'success' | 'error'
  accessToken?: string
  error?: string
  interval?: number
}

/** Message types between content script and service worker */
export type MessageType =
  | { type: 'FETCH_TREE'; owner: string; repo: string; branch: string }
  | { type: 'FETCH_BRANCHES'; owner: string; repo: string }
  | { type: 'FETCH_BRANCH_MATCHES'; owner: string; repo: string; prefix: string }
  | { type: 'FETCH_RAW'; owner: string; repo: string; branch: string; path: string }
  | { type: 'FETCH_RELEASES'; owner: string; repo: string; page?: number; perPage?: number }
  | { type: 'FETCH_RELEASE_ASSET'; url: string; fileName: string }
  | { type: 'SET_TOKEN'; token: string }
  | { type: 'GET_TOKEN' }
  | { type: 'GET_GITHUB_AUTH_STATUS'; force?: boolean }
  | { type: 'SET_GITHUB_OAUTH_CLIENT_ID'; clientId: string }
  | { type: 'START_GITHUB_DEVICE_FLOW'; clientId?: string }
  | { type: 'POLL_GITHUB_DEVICE_FLOW'; clientId?: string; deviceCode: string }
  | { type: 'SET_AI_KEY'; key: string }
  | { type: 'GET_AI_KEY' }
  | { type: 'AI_CHAT'; baseUrl: string; model: string; messages: AIChatMessage[] }
  | { type: 'AI_CHAT_STREAM'; baseUrl: string; model: string; messages: AIChatMessage[] }

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TreeCacheEntry {
  sha: string
  nodes: FlatNode[]
  timestamp: number
}

export interface BranchCacheEntry {
  branch: string
  timestamp: number
}

export interface SettingsState {
  dockSide: 'left' | 'right'
  panelWidth: number
  panelVisible: boolean
}
