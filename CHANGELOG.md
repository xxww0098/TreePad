# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.0] - 2025-03-24

### Added

- **History Panel** (`HistoryPanel.vue`) - 查看和管理对话历史
- **Mention Panel** (`MentionPanel.vue`) - 提及功能面板
- **Release Panel** (`ReleasePanel.vue`) - 发布信息展示面板
- **Message List** (`MessageList.vue`) - 消息列表组件，带测试
- **Action Dock** (`TreePadActionDock.vue`) - 快捷操作停靠栏
- **Composer** (`TreePadComposer.vue`) - 消息输入组件
- **Quick Actions** (`TreePadQuickActions.vue`) - 快速操作按钮组

### New Composables

- `useChatSession` - 聊天会话管理（含测试）
- `useConversationHistory` - 对话历史管理
- `useDialogGeometry` - 对话框几何状态管理
- `useReleases` - 发布信息获取（含测试）
- `useStarCelebration` - 星标动画效果（含测试）

### Features

- **i18n 国际化支持** - 新增 `locales/` 目录，支持中英文
- **Markdown 运行时** (`markdown-runtime.js`) - 独立的 Markdown 渲染运行时
- **ZIP 运行时** (`zip-runtime.js`) - 独立的 ZIP 压缩运行时
- **单元测试** - 新增 Vitest 配置，为组件和 composables 添加测试
- **样式模块化** - 重构 CSS 结构，新增 `core.css`, `treepad.css`, `release.css`, `settings.css`

### Changed

- 更新 TreePad 扩展核心组件和功能
- 重构构建脚本和配置
- 优化样式架构和 CSS 模块组织

### Testing

- 新增组件测试：`MessageList.test.ts`, `ReleasePanel.test.ts`
- 新增 composable 测试：`useChatSession.test.ts`, `useGitHub.test.ts`, `useReleases.test.ts`, `useStarCelebration.test.ts`
- 新增 store 测试：`settings.test.ts`, `tree.test.ts`
- 新增工具函数测试：`attached-context.test.ts`, `mentions.test.ts`, `tree-visibility.test.ts`

### Technical

- 新增工具函数：`attached-context.ts`, `mentions.ts`, `navigation.ts`, `tree-visibility.ts`
- 新增共享模块：`encoding.ts`, `tree-utils.ts`
- 新增构建配置：`vite.config.markdown-runtime.ts`, `vite.config.zip-runtime.ts`
- 移除旧的 `release.sh` 脚本

## [0.3.0] - 2025-XX-XX

### Features

- Initial release with core TreePad functionality
- GitHub file tree browser with virtual scrolling
- AI chat integration
- GitHub authentication with token encryption
- Settings panel with position, opacity, and language options
