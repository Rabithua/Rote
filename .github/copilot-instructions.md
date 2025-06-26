# Copilot Instructions for Rote Project

## Project Overview

Rote 是一个开源的个人笔记仓库系统，采用前后端分离架构，支持开放 API、用户数据自主控制、Docker 一键部署等核心特性。

## Technology Stack

- **运行时环境**: Bun (替代 Node.js，提供更快的性能)
- **后端技术**: Bun + TypeScript + Express + Prisma + MongoDB
- **前端技术**: React + TypeScript + Vite + Tailwind CSS + Radix UI
- **数据存储**: MongoDB (数据库) + AWS S3/R2 (文件存储)
- **部署方式**: Docker 容器化部署

## Code Standards & Guidelines

### 通用规范

- 运行时：使用 Bun 作为 JavaScript 运行时，获得更快的启动速度和执行性能
- 包管理：统一使用 `bun install` 安装依赖，`bun run` 执行脚本
- 代码质量：遵循 ESLint 配置规则和最佳实践
- React 规范：优先使用函数式组件和 React Hooks
- 注释语言：代码注释使用中文，便于团队理解
- 命名规范：变量名、函数名使用英文驼峰命名法
- 代码组织：避免单个文件代码过长，保持每个文件在 200 行以内，适当拆分组件和函数
- 逻辑简化：实现功能时优先考虑 `简化逻辑，避免过度复杂化`
- 代码复用：多复用函数和组件，减少重复代码，提高代码维护性
- 测试策略：在没有明确说明的情况下不需要编写测试代码
- 国际化：前端实现时必须考虑国际化支持，确保多语言兼容性
- 文档风格：编写文档保持简洁明了，关注核心内容，避免使用 emoji，可以适当使用其他符号增强可读性

### 后端开发规范 (Bun + Express)

- 运行时环境：使用 Bun 作为 JavaScript 运行时，享受更快的执行性能
- 数据库操作：使用 Prisma 作为 ORM，统一操作 MongoDB 数据库
- 路由组织：API 路由分为 v1 和 v2 版本，统一放置在 `route/` 目录
- 中间件管理：所有中间件文件放置在 `middleware/` 目录
- 工具函数：通用工具函数放置在 `utils/` 目录
- 类型定义：TypeScript 类型定义放置在 `types/` 目录
- 会话管理：使用 express-session 进行用户会话管理
- 身份验证：使用 passport 进行用户身份验证和授权
- 安全控制：实现 API 访问限流机制，防止滥用
- 文件存储：支持文件上传到 AWS S3/R2 云存储服务

### 前端开发规范 (React + TypeScript)

- 构建工具：使用 Vite 作为前端构建工具，提供快速的开发体验
- UI 组件：使用 Radix UI + Tailwind CSS 构建现代化界面
- 组件组织：页面级组件放置在 `pages/` 目录，可复用组件放置在 `components/` 目录
- 状态管理：使用 `jotai` 进行状态管理
- 网络请求：使用 `frontend/src/utils/api.ts` 封装好的方法，统一 API 请求
- 国际化：支持多语言 (i18n)，语言配置文件放置在 `locales/` 目录
- 设计系统：使用 shadcn/ui 组件系统，保持界面一致性
- always use Tailwind v4, never use Tailwind v3

### API 设计规范

- 设计原则：严格遵循 RESTful API 设计原则和最佳实践
- 错误处理：实现统一的错误处理机制和标准化响应格式
- 功能支持：全面支持分页查询、条件搜索、数据过滤等功能
- 文档维护：API 接口文档统一维护在 `server/doc/` 目录
- 认证机制：实现基于 API Key 的安全认证机制

## File Structure Conventions

### Backend Structure

```
server/
├── server.ts           # 主服务器文件
├── route/             # API 路由
├── middleware/        # 中间件
├── utils/            # 工具函数
├── types/            # 类型定义
├── prisma/           # 数据库 schema
├── scripts/          # 脚本文件
└── schedule/         # 定时任务
```

### Frontend Structure

```
web/
├── src/
│   ├── pages/        # 页面组件
│   ├── components/   # 可复用组件
│   ├── layout/       # 布局组件
│   ├── utils/        # 工具函数
│   ├── state/        # 状态管理
│   ├── types/        # 类型定义
│   └── locales/      # 国际化文件
```
