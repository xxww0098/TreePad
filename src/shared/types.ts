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
}

/** Message types between content script and service worker */
export type MessageType =
  | { type: 'FETCH_TREE'; owner: string; repo: string; branch: string }
  | { type: 'FETCH_BRANCHES'; owner: string; repo: string }
  | { type: 'FETCH_RAW'; owner: string; repo: string; branch: string; path: string }
  | { type: 'SET_TOKEN'; token: string }
  | { type: 'GET_TOKEN' }
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

export interface SettingsState {
  dockSide: 'left' | 'right'
  panelWidth: number
  panelVisible: boolean
}
