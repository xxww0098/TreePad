# TreePad

> 一个高性能的 GitHub 文件树浏览器扩展，集成 AI 对话功能。

---

## 功能特性

### 🌲 文件树

- 在任何 GitHub 仓库页面注入侧边栏文件树
- 可展开/折叠目录 —— 一键折叠全部
- O(1) 子树跳过，深度嵌套仓库也能快速渲染
- 虚拟滚动（TanStack Virtual）—— 轻松处理数万文件的仓库
- 点击文件跳转，点击目录展开
- 键盘导航 —— 方向键、回车、Cmd+P 搜索

### 🔍 搜索

- 全路径模糊搜索（Fuse.js）
- 即时结果并高亮匹配内容
- 快捷键 Cmd+P 打开搜索，ESC 清空

### 📦 下载 ZIP

- 一键下载任意目录为 `.zip` 文件
- 实时进度提示，显示 `已完成 / 总数` 文件数
- 支持取消操作，完成后报告失败的文件
- 使用 fflate 压缩（WebAssembly 级别性能，页内运行）

### 🔑 GitHub 认证

- 同一个加密输入框支持细粒度 PAT、经典 PAT、以及 GitHub OAuth access token
- 新增 GitHub OAuth Device Flow 登录方式，更适合浏览器扩展场景；只需要 OAuth App Client ID，无需在扩展里内置 client secret
- 自动回退到 GitHub 会话 Cookie —— 当 GitHub 接受当前浏览器会话用于 API 调用时可零配置工作
- 设置页会直接显示当前认证方式和剩余 GitHub API 额度
- 默认分支会缓存，后台会对相同 GitHub 请求做去重，减少不必要的 API 消耗
- Token 使用 AES-GCM 加密存储，不以明文保存

### ⚙️ 设置

| 设置项 | 选项 |
|---|---|
| 面板位置 | 左侧 / 右侧 |
| 面板透明度 | 30–100% |
| 语言 | 中文 / English |
| Star 庆祝动画 | 开 / 关（点击 ★ 时的粒子效果） |

### 🤖 TreePad — AI 文件对话

灵感来自 GitHub Copilot 的"询问此文件"。在文件（blob）页面显示。

- **悬浮对话框** —— 默认位于屏幕底部居中
- **可拖动** —— 拖动标题栏可移动到任意位置
- **可调整大小** —— 拖动任意边缘或角落，围绕中心轴对称缩放
- **记住尺寸** —— 偏好的对话框尺寸会跨会话保持
- **重置按钮** —— 一键恢复默认尺寸和居中位置
- **最小化为胶囊** —— 将对话框折叠为底部小标签，不丢失对话内容；点击标签恢复
- **失焦自动最小化** —— 点击外部时对话框自动折叠（AI 流式输出时不会最小化）
- **流式响应** —— 通过 OpenAI SSE 流式实时输出（使用 `chrome.runtime.connect` 端口实现低延迟传输）
- **Markdown 渲染** —— 完整支持 GFM，包括代码块、表格、列表、粗体、行内代码、引用
- **文件上下文** —— 当前文件内容作为系统提示词附加到每次请求
- **可移除文件标签** —— 需要通用对话时可移除文件附件

#### TreePad 设置

- **接口地址** —— 任意 OpenAI 兼容端点（OpenAI、Azure、本地 Ollama 等）
- **API Key** —— 使用 AES-GCM 加密，与 GitHub Token 相同机制
- **模型** —— 设置任意模型名称（默认：`gpt-4o-mini`）

---

## 技术栈

| 层级 | 库 / API |
|---|---|
| 框架 | Vue 3.5（组合式 API、`<script setup>`） |
| 状态管理 | Pinia |
| 虚拟列表 | @tanstack/vue-virtual |
| 模糊搜索 | Fuse.js |
| ZIP 压缩 | fflate |
| Markdown | marked |
| 存储 | chrome.storage.local + idb-keyval |
| 加密 | Web Crypto API（AES-GCM、PBKDF2） |
| 构建 | Vite 8 + vue-tsc |

---

## 项目架构

```
src/
├── background/        # Service worker
│   └── index.ts       # GitHub API 代理、Token 加解密、AI 流式传输
├── content/           # 注入到 github.com
│   ├── App.vue        # 根组件；连接所有 composables 和组件
│   ├── components/    # TreePanel、FileTree、SearchBar、SettingsView、TreePadDialog …
│   ├── composables/   # useTree、useSearch、useKeyboard、useTheme、useI18n …
│   └── stores/        # settings（Pinia）、tree（Pinia）
└── shared/            # 类型定义、常量、GitHub API 辅助函数、树构建器
```

内容脚本 ↔ 后台脚本通过 `chrome.runtime.sendMessage`（一次性）和 `chrome.runtime.connect` 端口（AI 流式）通信。

---

## 安装使用

1. `bun install`
2. `bun run build`
3. 打开 `chrome://extensions` → **加载已解压的扩展程序** → 选择 `dist/` 文件夹
4. 后续更新时请保持使用同一个已加载目录，否则 Chrome 可能会分配新的扩展 ID，本地存储里的 GitHub Token 等数据也不会继承

## 发布版 OAuth 配置

1. 将 `.env.example` 复制为 `.env.production.local`
2. 填入 `VITE_GITHUB_OAUTH_CLIENT_ID`
3. 填入 `VITE_GITHUB_OAUTH_APP_HOMEPAGE` 和 `TREEPAD_EXTENSION_ID`
4. 运行 `./build.sh` 或 `./build.sh --zip`
5. 安装和更新时请优先加载 `TreePad-unpacked/`，这样扩展 ID 会保持稳定
6. 打开发布产物目录中的 `GITHUB_OAUTH_SETUP.md`

详细说明见：[docs/GITHUB_OAUTH.md](./docs/GITHUB_OAUTH.md)

---

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 持久化设置和加密 Token |
| `cookies` | 读取 GitHub 会话 Cookie 实现零配置认证 |
| `https://github.com/*` | 注入内容脚本 |
| `https://api.github.com/*` | 获取仓库文件树和分支 |
| `https://raw.githubusercontent.com/*` | 获取原始文件内容 |
| `https://*/*` | 调用用户配置的 AI API 端点 |
