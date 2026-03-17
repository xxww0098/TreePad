# TreePad

> A high-performance GitHub file tree browser with AI chat, built as a Chrome extension.

---

## Features

### 🌲 File Tree

- Instant file tree sidebar injected into any GitHub repository page
- Expandable / collapsible directories — collapse-all in one click
- O(1) subtree skip for fast rendering of deeply nested repos
- Virtual scrolling (TanStack Virtual) — handles repos with tens of thousands of files without slowdown
- Click any file to navigate; click a directory to expand
- Keyboard navigation — arrow keys, Enter, Cmd+P to search

### 🔍 Search

- Fuzzy full-text search across all file paths (Fuse.js)
- Instant results with match highlighting
- Keyboard shortcut Cmd+P to open, ESC to clear

### 📦 Download as ZIP

- Download any directory as a `.zip` with one click
- Real-time progress toast showing `done / total` files
- Cancellation support; reports failed files after completion
- Powered by fflate (fast WebAssembly-grade compression, runs in-page)

### 🔑 GitHub Authentication

- Supports fine-grained PATs, classic PATs, and GitHub OAuth access tokens in the same encrypted token field
- Optional GitHub OAuth Device Flow sign-in for extension-friendly login (works with an OAuth App Client ID, no embedded client secret)
- Falls back to GitHub session cookies automatically — zero config for logged-in users when GitHub accepts the browser session for API calls
- Shows current auth mode plus remaining GitHub API quota directly in Settings
- Caches default branches and deduplicates in-flight GitHub requests to reduce unnecessary API usage
- Tokens are encrypted with AES-GCM before storage; never stored in plaintext

### ⚙️ Settings

| Setting | Options |
|---|---|
| Panel position | Left / Right |
| Panel opacity | 30–100% |
| Language | English / 中文 |
| Star celebration | On / Off (particle animation on ★) |

### 🤖 TreePad — AI File Chat

Inspired by GitHub Copilot's "Ask about this file". Appears on file (`blob`) pages only.

- **Floating dialog** — centered at the bottom of the screen by default
- **Draggable** — drag the header to reposition anywhere
- **Resizable** — drag any edge or corner; resizes symmetrically around the center axis
- **Remembered size** — your preferred dialog dimensions are persisted across sessions
- **Reset button** — one click to return to default size and centered position
- **Minimize to pill** — collapse the dialog to a small bottom tab without losing the conversation; click the tab to restore
- **Auto-minimize on blur** — dialog collapses automatically when you click outside (won't minimize while AI is streaming)
- **Streaming responses** — real-time token-by-token output via OpenAI SSE streaming (uses `chrome.runtime.connect` ports for low-latency delivery)
- **Markdown rendering** — full GFM support including code blocks, tables, lists, bold, inline code, blockquotes
- **File context** — current file content is attached to every request as a system prompt
- **Detachable file chip** — remove the file attachment when you want a general-purpose conversation

#### TreePad Settings

- **Base URL** — any OpenAI-compatible endpoint (OpenAI, Azure, local Ollama, etc.)
- **API Key** — encrypted with AES-GCM, same mechanism as the GitHub token
- **Model** — set any model name (default: `gpt-4o-mini`)

---

## Tech Stack

| Layer | Library / API |
|---|---|
| Framework | Vue 3.5 (Composition API, `<script setup>`) |
| State | Pinia |
| Virtual list | @tanstack/vue-virtual |
| Fuzzy search | Fuse.js |
| ZIP compression | fflate |
| Markdown | marked |
| Storage | chrome.storage.local + idb-keyval |
| Encryption | Web Crypto API (AES-GCM, PBKDF2) |
| Build | Vite 8 + vue-tsc |

---

## Architecture

```
src/
├── background/        # Service worker
│   └── index.ts       # GitHub API proxy, token encrypt/decrypt, AI streaming
├── content/           # Injected into github.com
│   ├── App.vue        # Root; wires up all composables + components
│   ├── components/    # TreePanel, FileTree, SearchBar, SettingsView, TreePadDialog …
│   ├── composables/   # useTree, useSearch, useKeyboard, useTheme, useI18n …
│   └── stores/        # settings (Pinia), tree (Pinia)
└── shared/            # Types, constants, GitHub API helpers, tree builder
```

Content script ↔ background communicate via `chrome.runtime.sendMessage` (one-shot) and `chrome.runtime.connect` ports (streaming AI).

---

## Installation

1. `bun install`
2. `bun run build`
3. Open `chrome://extensions` → **Load unpacked** → select the `dist/` folder

## Release OAuth Setup

1. Copy `.env.example` to `.env.production.local`
2. Fill `VITE_GITHUB_OAUTH_CLIENT_ID` with your GitHub OAuth App client ID
3. Fill `VITE_GITHUB_OAUTH_APP_HOMEPAGE` and `TREEPAD_EXTENSION_ID`
4. Run `./build.sh` or `./build.sh --zip`
5. Open the generated `GITHUB_OAUTH_SETUP.md` in the release output folder

Detailed guide: [docs/GITHUB_OAUTH.md](./docs/GITHUB_OAUTH.md)

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist settings and encrypted tokens |
| `cookies` | Read GitHub session cookie for zero-config auth |
| `https://github.com/*` | Inject content script |
| `https://api.github.com/*` | Fetch repo tree and branches |
| `https://raw.githubusercontent.com/*` | Fetch raw file content |
| `https://*/*` | Call user-configured AI API endpoints |
