# Rote Web Frontend

Rote 前端应用，基于 React + TypeScript + Vite 构建的现代化 Web 应用。

## 技术栈

- **构建工具**: Vite 7.x
- **运行时**: Bun（推荐）或 Node.js
- **框架**: React 19 + TypeScript
- **UI 组件库**: Radix UI + Tailwind CSS v4
- **状态管理**: Jotai
- **路由**: React Router v7
- **国际化**: react-i18next
- **样式**: Tailwind CSS v4 + @tailwindcss/typography
- **PWA 支持**: vite-plugin-pwa
- **代码质量**: ESLint + Prettier + TypeScript

## 开发环境设置

### 前置要求

- Bun >= 1.0（推荐）或 Node.js >= 18
- 已配置的后端 API 服务（参考主项目 README）

### 安装依赖

```bash
# 使用 Bun（推荐）
bun install

# 或使用 npm
npm install
```

### 环境变量配置

创建 `.env` 文件（可选，默认使用 `http://localhost:18000`）：

```env
VITE_API_BASE=http://localhost:18000
```

## 开发命令

```bash
# 启动开发服务器（默认端口 3001）
bun run dev

# 或使用 npm
npm run dev

# 代码检查
bun run lint

# 构建生产版本
bun run build

# 预览生产构建
bun run preview
```

## 项目结构

```
web/
├── src/
│   ├── pages/          # 页面组件
│   ├── components/     # 可复用组件
│   ├── layout/         # 布局组件
│   ├── utils/          # 工具函数
│   ├── state/          # 状态管理（Jotai）
│   ├── types/          # TypeScript 类型定义
│   ├── locales/        # 国际化文件
│   ├── hooks/          # 自定义 Hooks
│   ├── route/          # 路由配置
│   └── styles/         # 样式文件
├── public/             # 静态资源
├── dist/               # 构建输出目录
└── vite.config.ts      # Vite 配置
```

## 构建和部署

### 开发环境

开发服务器默认运行在 `http://localhost:3001`，支持热模块替换（HMR）。

### 生产构建

```bash
# 构建生产版本
bun run build

# 构建产物位于 dist/ 目录
```

### Docker 部署

前端应用通过 Docker 容器化部署，详细部署说明请参考：

- 主项目 README 中的部署指南
- `/src/pages/doc/selfhosted` 页面中的自托管部署文档

### 环境变量注入

`VITE_API_BASE` 环境变量在构建时注入到前端代码中，用于配置后端 API 地址。如果未设置，默认使用 `http://localhost:18000`。

## 代码规范

### ESLint 配置

项目使用 TypeScript ESLint 进行代码检查，主要规则包括：

- TypeScript 类型检查
- React Hooks 规则
- Prettier 代码格式化
- 自定义 React 最佳实践规则

### 代码风格

- 使用函数式组件和 React Hooks
- 优先使用 TypeScript 类型定义
- 遵循 ESLint 和 Prettier 配置
- 代码注释使用中文

### 文件组织

- 页面级组件放置在 `pages/` 目录
- 可复用组件放置在 `components/` 目录
- 工具函数放置在 `utils/` 目录
- 状态管理使用 Jotai，放置在 `state/` 目录

## 国际化

项目支持多语言，语言文件位于 `src/locales/` 目录：

- `zh.json` - 简体中文
- `en.json` - 英文

添加新语言或翻译内容时，请同时更新这两个文件。

## PWA 支持

项目配置了 PWA（Progressive Web App）支持，包括：

- Service Worker 自动更新
- 离线缓存策略
- Web App Manifest

Service Worker 文件位于 `src/sw.js`。

## 注意事项

- **Tailwind CSS**: 项目使用 Tailwind CSS v4，请勿使用 v3 语法
- **路径别名**: 使用 `@/` 作为 `src/` 目录的别名
- **API 请求**: 统一使用 `src/utils/api.ts` 中封装的方法
- **状态管理**: 使用 Jotai 进行状态管理，避免使用 Context API 处理复杂状态

## 相关文档

- [主项目 README](../README.md)
- [自托管部署指南](../doc/userguide/)
- [API 文档](../doc/userguide/API-ENDPOINTS.md)
