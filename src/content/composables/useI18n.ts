import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const messages = {
  en: {
    // Settings - Token
    'settings.token.title': 'GitHub Token',
    'settings.token.desc': 'Personal Access Token (public_repo scope). Raises API limit from 60 to 5,000 req/hr.',
    'settings.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.token.remove': 'Remove',
    'settings.token.save': 'Save',
    'settings.token.hint': 'Encrypted (AES-GCM) and stored locally.',

    // Settings - Appearance
    'settings.appearance.title': 'Appearance',
    'settings.appearance.position': 'Panel Position',
    'settings.appearance.left': 'Left',
    'settings.appearance.right': 'Right',
    'settings.appearance.opacity': 'Panel Opacity',
    'settings.appearance.language': 'Language',

    // Settings - Fun
    'settings.fun.title': 'Fun',
    'settings.fun.celebrate': 'Star celebration',
    'settings.fun.celebrateDesc': 'Show particle animation when starring a repo.',

    // Header
    'header.fallback': 'Repo Tree',
    'header.collapse': 'Collapse all',
    'header.settings': 'Settings',
    'header.close': 'Close panel',

    // Search
    'search.placeholder': 'Search files... (Cmd+P)',

    // Tree node
    'tree.downloadZip': 'Download as ZIP',

    // Toggle
    'toggle.title': 'Toggle file tree',

    // Download toast
    'download.zipping': 'Zipping...',
    'download.done': 'Done!',
    'download.doneFailed': 'Done ({count} failed)',
    'download.cancelled': 'Cancelled',
    'download.error': '{count} file(s) failed',
    'download.progress': '{done}/{total} files',
    'download.confirm': 'This folder contains {count} files. Download anyway?',
    'download.root': 'root',

    // API errors
    'api.rateLimit': 'API rate limit exceeded — set a GitHub token (Settings gear) to raise from 60 to 5,000 req/hr',
    'api.rateLimitCookie': 'API rate limit exceeded (cookie auth may have failed) — try setting a GitHub token (Settings gear)',
    'api.invalidToken': 'Invalid GitHub token — please update or remove it (Settings gear)',

    // TreePad
    'treepad.title': 'TreePad',
    'treepad.button': 'Ask AI about this file',
    'treepad.disclaimer': 'AI-generated — verify important info.',
    'treepad.placeholder': 'Ask anything about this file...',
    'treepad.send': 'Send',
    'treepad.thinking': 'Thinking...',
    'treepad.error': 'Request failed. Check your AI settings.',
    'treepad.empty': 'Ask a question about the current file.',
    'treepad.fileAttached': 'File attached',
    'treepad.removeFile': 'Remove file',
    'treepad.resetSize': 'Reset to default size',
    'treepad.minimize': 'Minimize',

    // Settings - AI
    'settings.ai.title': 'AI (TreePad)',
    'settings.ai.desc': 'OpenAI-compatible API for the TreePad chat. API key is encrypted locally.',
    'settings.ai.baseUrl': 'Base URL',
    'settings.ai.baseUrlPlaceholder': 'https://api.openai.com/v1',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyPlaceholder': 'sk-...',
    'settings.ai.model': 'Model',
    'settings.ai.modelPlaceholder': 'gpt-4o-mini',
  },
  zh: {
    // Settings - Token
    'settings.token.title': 'GitHub 令牌',
    'settings.token.desc': '可将 API 限制从 60 提升至 5,000 次/小时',
    'settings.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.token.remove': '移除',
    'settings.token.save': '保存',
    'settings.token.hint': '已加密（AES-GCM）并本地存储。',

    // Settings - Appearance
    'settings.appearance.title': '外观',
    'settings.appearance.position': '面板位置',
    'settings.appearance.left': '左侧',
    'settings.appearance.right': '右侧',
    'settings.appearance.opacity': '面板透明度',
    'settings.appearance.language': '语言',

    // Settings - Fun
    'settings.fun.title': '趣味',
    'settings.fun.celebrate': 'Star 庆祝动画',
    'settings.fun.celebrateDesc': '点亮 Star 时显示粒子动画。',

    // Header
    'header.fallback': 'Repo Tree',
    'header.collapse': '全部折叠',
    'header.settings': '设置',
    'header.close': '关闭面板',

    // Search
    'search.placeholder': '搜索文件... (Cmd+P)',

    // Tree node
    'tree.downloadZip': '下载为 ZIP',

    // Toggle
    'toggle.title': '切换文件树',

    // Download toast
    'download.zipping': '正在压缩...',
    'download.done': '完成！',
    'download.doneFailed': '完成（{count} 个失败）',
    'download.cancelled': '已取消',
    'download.error': '{count} 个文件失败',
    'download.progress': '{done}/{total} 个文件',
    'download.confirm': '此文件夹包含 {count} 个文件，是否继续下载？',
    'download.root': '根目录',

    // API errors
    'api.rateLimit': 'API 请求超限 — 请在设置中配置 GitHub 令牌，可提升至 5,000 次/小时',
    'api.rateLimitCookie': 'API 请求超限（Cookie 认证可能失效）— 请尝试在设置中配置 GitHub 令牌',
    'api.invalidToken': 'GitHub 令牌无效 — 请在设置中更新或移除',

    // TreePad
    'treepad.title': 'TreePad',
    'treepad.button': '询问 AI 关于此文件',
    'treepad.disclaimer': 'AI 生成内容 — 请核实重要信息。',
    'treepad.placeholder': '询问关于此文件的任何问题...',
    'treepad.send': '发送',
    'treepad.thinking': '思考中...',
    'treepad.error': '请求失败，请检查 AI 设置。',
    'treepad.empty': '向 AI 提问关于当前文件的问题。',
    'treepad.fileAttached': '已附加文件',
    'treepad.removeFile': '移除文件',
    'treepad.resetSize': '恢复默认大小',
    'treepad.minimize': '最小化',

    // Settings - AI
    'settings.ai.title': 'AI (TreePad)',
    'settings.ai.desc': 'OpenAI 兼容 API，用于 TreePad 对话。API Key 已加密本地存储。',
    'settings.ai.baseUrl': '接口地址',
    'settings.ai.baseUrlPlaceholder': 'https://api.openai.com/v1',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyPlaceholder': 'sk-...',
    'settings.ai.model': '模型',
    'settings.ai.modelPlaceholder': 'gpt-4o-mini',
  },
} as const

type MessageKey = keyof typeof messages.en

export function useI18n() {
  const settings = useSettingsStore()

  const t = computed(() => {
    const locale = settings.locale
    const dict = messages[locale]
    return (key: MessageKey, params?: Record<string, string | number>): string => {
      let text = (dict as any)[key] ?? (messages.en as any)[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    }
  })

  return { t }
}
