import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const messages = {
  en: {
    // Settings - GitHub
    'settings.github.title': 'Connect GitHub',
    'settings.github.desc': 'Connect GitHub for higher API limits and private repo access.',
    'settings.github.rateLimit': 'Quota left',
    'settings.github.refreshStatus': 'Refresh',
    'settings.github.refreshing': 'Checking connection...',
    'settings.github.rateUnknown': 'Not available',
    'settings.github.rateValue': '{remaining}/{limit} left',
    'settings.github.resetAt': 'Resets around {time}',
    'settings.github.cookieWarn': 'You are signed into GitHub in the browser, but API requests are still being treated as anonymous. Connect with OAuth or a token for a more reliable setup.',
    'settings.github.openTokenPage': 'Connect GitHub',
    'settings.github.manageConnection': 'Update connection',
    'settings.github.summaryOn': 'GitHub connected',
    'settings.github.summaryWarn': 'Connection needs attention',
    'settings.github.summaryWarnDesc': 'Your browser session looks signed in, but GitHub API access is still limited.',
    'settings.github.summaryOff': 'GitHub not connected',
    'settings.github.summaryOffDesc': 'Connect once to raise the API limit from 60 to 5,000 requests per hour.',
    'settings.github.tokenTemplateOpened': 'GitHub’s token page is open. Create a token, copy it, then click “Connect GitHub” again.',
    'settings.github.showTokenGuide': 'Need help? Show token steps',
    'settings.github.hideTokenGuide': 'Hide token steps',
    'settings.github.tokenStep1': '1. Click “Connect GitHub” to open GitHub’s token page.',
    'settings.github.tokenStep2': '2. Create the token in GitHub and copy it.',
    'settings.github.tokenStep3': '3. Come back here and click “Connect GitHub” again. TreePad will read the copied token automatically.',

    // Settings - Token
    'settings.token.inputLabel': 'GitHub token',
    'settings.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.token.remove': 'Remove',
    'settings.token.save': 'Save',
    'settings.token.pasteAndSave': 'Paste & Save',
    'settings.token.hint': 'Saved on this device only and encrypted before storage.',
    'settings.token.clipboardEmpty': 'No GitHub token found in the clipboard.',
    'settings.token.clipboardDenied': 'Unable to read the clipboard. Please paste the token manually.',

    // Settings - OAuth
    'settings.oauth.title': 'GitHub OAuth',
    'settings.oauth.clientId': 'OAuth App Client ID',
    'settings.oauth.clientIdPlaceholder': 'Iv1.1234567890abcdef',
    'settings.oauth.saveClientId': 'Save Client ID',
    'settings.oauth.start': 'Connect GitHub',
    'settings.oauth.hint': 'Uses GitHub Device Flow. Best for browser extensions.',
    'settings.oauth.ready': 'GitHub sign-in is ready in this build.',
    'settings.oauth.showAdvanced': 'Advanced setup',
    'settings.oauth.hideAdvanced': 'Hide advanced setup',
    'settings.oauth.advancedHint': 'Only needed for local or self-built versions without a GitHub OAuth client ID.',
    'settings.oauth.userCode': 'GitHub user code',
    'settings.oauth.instructions': 'Enter this code on GitHub and approve TreePad. TreePad will finish connecting automatically.',
    'settings.oauth.openPage': 'Open GitHub',
    'settings.oauth.polling': 'Waiting for GitHub authorization...',
    'settings.oauth.started': 'GitHub sign-in started. Finish the confirmation in the new tab.',
    'settings.oauth.success': 'GitHub is now connected.',
    'settings.oauth.failed': 'GitHub sign-in failed. Please try again.',
    'settings.oauth.clientIdSaved': 'OAuth client ID saved.',

    // Settings - Appearance
    'settings.appearance.title': 'Appearance',
    'settings.appearance.position': 'Panel Position',
    'settings.appearance.left': 'Left',
    'settings.appearance.right': 'Right',
    'settings.appearance.opacity': 'Panel Opacity',
    'settings.appearance.opacityDecrease': 'Decrease panel opacity',
    'settings.appearance.opacityIncrease': 'Increase panel opacity',
    'settings.appearance.opacityHint': 'Drag for quick changes, then use -/+ for 1% fine tuning.',
    'settings.appearance.language': 'Language',

    // Settings - Fun
    'settings.fun.title': 'Fun',
    'settings.fun.celebrate': 'Star celebration',

    // Header
    'header.fallback': 'TreePad',
    'header.openRepo': 'Open repository page',
    'header.collapse': 'Collapse all',
    'header.downloadAll': 'Download all files',
    'header.settings': 'Settings',
    'header.close': 'Close panel',

    // Search
    'search.label': 'Search files and folders',
    'search.placeholder': 'Search files and folders...',
    'search.shortcut': 'Cmd+P',

    // Tree node
    'tree.downloadZip': 'Download as ZIP',
    'tree.downloadFile': 'Download file',

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
    'treepad.placeholder': 'Ask about this file, or type @ to attach more...',
    'treepad.send': 'Send',
    'treepad.thinking': 'Thinking...',
    'treepad.error': 'Request failed. Check your AI settings.',
    'treepad.empty': 'Ask a question about the current file.',
    'treepad.empty.title': 'What can I help with?',
    'treepad.empty.eyebrow': 'Three focused starters',
    'treepad.empty.subtitle': 'The entry point is distilled into three high-frequency tasks: understand the file, trace the logic, or review for risks.',
    'treepad.quick.label1': 'Orientation',
    'treepad.quick.label2': 'Execution flow',
    'treepad.quick.label3': 'Risk review',
    'treepad.quick.tip1': 'Understand this file',
    'treepad.quick.tip2': 'Trace the core logic',
    'treepad.quick.tip3': 'Check for potential issues',
    'treepad.quick.desc1': 'Clarify what this file owns, its key inputs and outputs, and where it fits in the project.',
    'treepad.quick.desc2': 'Break down the main flow, important branches, and the parts that matter before you edit.',
    'treepad.quick.desc3': 'Look for bugs, edge cases, and quality issues so risks surface earlier.',
    'treepad.quick.hint1': 'Best when the file is new to you',
    'treepad.quick.hint2': 'Best before editing or refactoring',
    'treepad.quick.hint3': 'Best before commit or debugging',
    'treepad.quick.prompt1': 'Please explain the purpose of the current file, its main responsibilities, its key inputs and outputs, and how it fits into the project.',
    'treepad.quick.prompt2': 'Summarize the core logic of this file, including the execution flow, important branches, and the key functions or state changes worth understanding first.',
    'treepad.quick.prompt3': 'Review this file for potential bugs, risky edge cases, and code-quality issues. Prioritize concrete findings and explain why they matter.',
    'treepad.action.history': 'History',
    'treepad.action.clear': 'Clear',
    'treepad.action.newChat': 'New chat',
    'treepad.action.historyHint': 'Restore a saved chat',
    'treepad.action.clearHint': 'Clear the current chat only',
    'treepad.action.newChatHint': 'Save current chat and start fresh',
    'treepad.history.title': 'Recent chats',
    'treepad.history.empty': 'No saved chats yet',
    'treepad.history.untitled': 'Untitled chat',
    'treepad.history.restore': 'Restore this chat',
    'treepad.fileAttached': 'File attached',
    'treepad.removeFile': 'Remove file',
    'treepad.resetSize': 'Reset to default size',
    'treepad.minimize': 'Minimize',
    'treepad.close': 'Close AI dialog',
    'treepad.addFiles': 'Add files',
    'treepad.searchFiles': 'Search files...',
    'treepad.noResults': 'No files found',
    'treepad.folder': 'folder',
    'treepad.filesAttached': '{count} file(s) attached',
    'treepad.stop': 'Stop generation',
    'treepad.clear': 'Clear conversation',
    'treepad.retry': 'Retry',

    // Settings - AI
    'settings.ai.title': 'AI (TreePad)',
    'settings.ai.desc': 'Connect any OpenAI-compatible endpoint. Your API key stays encrypted on this device.',
    'settings.ai.baseUrl': 'Base URL',
    'settings.ai.baseUrlPlaceholder': 'https://api.openai.com/v1',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyPlaceholder': 'sk-...',
    'settings.ai.model': 'Model',
    'settings.ai.modelPlaceholder': 'gpt-4o-mini',

  },
  zh: {
    // Settings - GitHub
    'settings.github.title': '连接 GitHub',
    'settings.github.desc': '连接 GitHub，可获得更高的 API 额度，并支持私有仓库访问。',
    'settings.github.rateLimit': '剩余额度',
    'settings.github.refreshStatus': '刷新',
    'settings.github.refreshing': '正在检查连接...',
    'settings.github.rateUnknown': '暂时无法获取',
    'settings.github.rateValue': '还剩 {remaining}/{limit}',
    'settings.github.resetAt': '大约 {time} 重置',
    'settings.github.cookieWarn': '你虽然已经在浏览器里登录了 GitHub，但 API 请求仍被当成匿名请求。建议改用 OAuth 或 Token，连接会更稳定。',
    'settings.github.openTokenPage': '连接 GitHub',
    'settings.github.manageConnection': '更新连接',
    'settings.github.summaryOn': 'GitHub 已连接',
    'settings.github.summaryWarn': '当前连接需要处理',
    'settings.github.summaryWarnDesc': '浏览器里看似已登录，但 GitHub API 访问仍然受限。',
    'settings.github.summaryOff': '尚未连接 GitHub',
    'settings.github.summaryOffDesc': '连接后可将 API 额度从 60 提升到 5,000 次/小时。',
    'settings.github.tokenTemplateOpened': 'GitHub Token 创建页已打开。创建并复制 Token 后，再点一次“连接 GitHub”。',
    'settings.github.showTokenGuide': '不会用？查看步骤',
    'settings.github.hideTokenGuide': '收起步骤',
    'settings.github.tokenStep1': '1. 点击“连接 GitHub”，打开 GitHub 的 Token 创建页。',
    'settings.github.tokenStep2': '2. 在 GitHub 创建 Token，并复制它。',
    'settings.github.tokenStep3': '3. 回到这里，再点一次“连接 GitHub”。TreePad 会自动读取你刚复制的 Token。',

    // Settings - Token
    'settings.token.inputLabel': 'GitHub Token',
    'settings.token.placeholder': 'ghp_xxxxxxxxxxxx',
    'settings.token.remove': '移除',
    'settings.token.save': '保存',
    'settings.token.pasteAndSave': '粘贴并保存',
    'settings.token.hint': '只保存在当前设备，并会先加密再存储。',
    'settings.token.clipboardEmpty': '剪贴板里没有检测到 GitHub Token。',
    'settings.token.clipboardDenied': '无法读取剪贴板，请手动粘贴 token。',

    // Settings - OAuth
    'settings.oauth.title': 'GitHub OAuth',
    'settings.oauth.clientId': 'OAuth App Client ID',
    'settings.oauth.clientIdPlaceholder': 'Iv1.1234567890abcdef',
    'settings.oauth.saveClientId': '保存 Client ID',
    'settings.oauth.start': '连接 GitHub',
    'settings.oauth.hint': '使用 GitHub Device Flow，适合浏览器扩展。',
    'settings.oauth.ready': '当前版本已内置 GitHub 登录。',
    'settings.oauth.showAdvanced': '高级设置',
    'settings.oauth.hideAdvanced': '收起高级设置',
    'settings.oauth.advancedHint': '只有本地自建、且没有预置 GitHub OAuth Client ID 的版本，才需要这里的配置。',
    'settings.oauth.userCode': 'GitHub 用户验证码',
    'settings.oauth.instructions': '在 GitHub 输入这串验证码并确认授权，TreePad 会自动完成连接。',
    'settings.oauth.openPage': '打开 GitHub',
    'settings.oauth.polling': '正在等待 GitHub 授权...',
    'settings.oauth.started': '已开始 GitHub 登录，请在新标签页完成确认。',
    'settings.oauth.success': 'GitHub 已连接。',
    'settings.oauth.failed': 'GitHub 登录失败，请重试。',
    'settings.oauth.clientIdSaved': 'OAuth Client ID 已保存。',

    // Settings - Appearance
    'settings.appearance.title': '外观',
    'settings.appearance.position': '面板位置',
    'settings.appearance.left': '左侧',
    'settings.appearance.right': '右侧',
    'settings.appearance.opacity': '面板透明度',
    'settings.appearance.opacityDecrease': '降低面板透明度',
    'settings.appearance.opacityIncrease': '提高面板透明度',
    'settings.appearance.opacityHint': '先拖到大概位置，再用 - / + 做 1% 微调。',
    'settings.appearance.language': '语言',

    // Settings - Fun
    'settings.fun.title': '趣味',
    'settings.fun.celebrate': 'Star 庆祝动画',

    // Header
    'header.fallback': 'TreePad',
    'header.openRepo': '打开仓库页面',
    'header.collapse': '全部折叠',
    'header.downloadAll': '下载全部文件',
    'header.settings': '设置',
    'header.close': '关闭面板',

    // Search
    'search.label': '搜索文件和文件夹',
    'search.placeholder': '搜索文件和文件夹...',
    'search.shortcut': 'Cmd+P',

    // Tree node
    'tree.downloadZip': '下载为 ZIP',
    'tree.downloadFile': '下载文件',

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
    'treepad.placeholder': '询问当前文件，输入 @ 可附加更多文件...',
    'treepad.send': '发送',
    'treepad.thinking': '思考中...',
    'treepad.error': '请求失败，请检查 AI 设置。',
    'treepad.empty': '向 AI 提问关于当前文件的问题。',
    'treepad.empty.title': '我可以帮你什么？',
    'treepad.empty.eyebrow': '三个核心功能',
    'treepad.empty.subtitle': '入口收束为三个高频任务：先理解文件定位，再梳理实现逻辑，最后检查潜在风险。',
    'treepad.quick.label1': '快速入门',
    'treepad.quick.label2': '读懂实现',
    'treepad.quick.label3': '质量检查',
    'treepad.quick.tip1': '理解文件作用',
    'treepad.quick.tip2': '梳理核心逻辑',
    'treepad.quick.tip3': '检查潜在问题',
    'treepad.quick.desc1': '说明这个文件负责什么、输入输出是什么，以及它在项目里的位置。',
    'treepad.quick.desc2': '提炼执行流程、关键分支和重要状态变化，修改前先建立全局理解。',
    'treepad.quick.desc3': '优先寻找 bug、边界条件和代码质量隐患，帮助你更早发现风险。',
    'treepad.quick.hint1': '适合第一次打开陌生文件',
    'treepad.quick.hint2': '适合改动前快速建立上下文',
    'treepad.quick.hint3': '适合提交前自查或排错',
    'treepad.quick.prompt1': '请解释当前文件的作用、主要职责、关键输入输出，以及它在项目中的位置。',
    'treepad.quick.prompt2': '总结这个文件的核心逻辑，包括执行流程、关键分支，以及值得优先理解的函数或状态变化。',
    'treepad.quick.prompt3': '审查这个文件，找出潜在 bug、风险边界条件和代码质量问题。请优先给出具体发现，并说明它们为什么重要。',
    'treepad.action.history': '历史',
    'treepad.action.clear': '清空',
    'treepad.action.newChat': '新对话',
    'treepad.action.historyHint': '恢复之前保存的对话',
    'treepad.action.clearHint': '只清空当前对话内容',
    'treepad.action.newChatHint': '保存当前对话并开始新的会话',
    'treepad.history.title': '最近对话',
    'treepad.history.empty': '还没有保存过对话',
    'treepad.history.untitled': '未命名对话',
    'treepad.history.restore': '恢复这段对话',
    'treepad.fileAttached': '已附加文件',
    'treepad.removeFile': '移除文件',
    'treepad.resetSize': '恢复默认大小',
    'treepad.minimize': '最小化',
    'treepad.close': '关闭 AI 对话框',
    'treepad.addFiles': '添加文件',
    'treepad.searchFiles': '搜索文件...',
    'treepad.noResults': '未找到文件',
    'treepad.folder': '目录',
    'treepad.filesAttached': '已附加 {count} 个文件',
    'treepad.stop': '停止生成',
    'treepad.clear': '清空对话',
    'treepad.retry': '重试',

    // Settings - AI
    'settings.ai.title': 'AI (TreePad)',
    'settings.ai.desc': '连接任意 OpenAI 兼容接口，为 TreePad 提供 AI 对话能力。API Key 只保存在本机，并且会加密存储。',
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
