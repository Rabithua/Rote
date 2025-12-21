<p align="right"><a href="../CONTRIBUTING.md">English</a> | 中文</p>

# Contributing to Rote

感谢你对 Rote 项目的关注！我们欢迎各种形式的贡献。

## 贡献方式

### 报告 Bug

如果你发现了 Bug，请：

1. 检查 [Issues](https://github.com/Rabithua/Rote/issues) 中是否已有相关问题
2. 如果没有，请创建新的 Issue，包含：
   - 清晰的 Bug 描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（操作系统、浏览器、版本等）

> **重要提示**：如果你发现的是**安全漏洞**（特别是涉及数据泄露的高危漏洞），请不要在公开的 Issue 中报告。请按照 [SECURITY.md](../SECURITY.md) 中的指导，通过邮件或 GitHub 安全建议功能进行报告，万分感谢。

### 建议功能

我们欢迎功能建议！请：

1. 检查是否已有类似的功能请求
2. 创建 Feature Request Issue，说明：
   - 功能的使用场景
   - 为什么这个功能对用户有价值
   - 考虑功能是否符合 Rote 的核心特性
   - 可能的实现思路（可选）

### 提交 Pull Request

1. **Fork 项目**并创建你的特性分支

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **编写代码**，遵循项目的代码规范

3. **提交更改**

   ```bash
   git commit -m "Add some amazing feature"
   ```

4. **推送到你的分支**

   ```bash
   git push origin feature/amazing-feature
   ```

5. **创建 Pull Request**

### 改进文档

文档改进同样重要！你可以：

- 修正拼写错误
- 改进文档的清晰度
- 添加缺失的文档
- 翻译文档到其他语言
- 对于后端接口的变动，需要同步修改 `doc` 目录下的接口文档

### 帮助翻译

Rote 支持多语言，我们欢迎翻译贡献：

- 翻译文件位于 `web/src/locales/` 目录
- 目前支持中文（zh.json）和英文（en.json）
- 需要确保你确实懂得你所贡献的语言语境，避免简单的机翻

## 代码规范

### 通用规范

- **运行时**：使用 Bun 作为 JavaScript 运行时
- **包管理**：统一使用 `bun install` 安装依赖，`bun run` 执行脚本
- **代码质量**：遵循 ESLint 配置规则，提交前运行 `bun run lint`
- **注释语言**：代码注释使用中文，便于团队理解
- **命名规范**：变量名、函数名使用英文驼峰命名法
- **代码组织**：避免单个文件代码过长，保持每个文件在 200 行以内
- **逻辑简化**：实现功能时优先考虑简化逻辑，避免过度复杂化
- **代码复用**：多复用函数和组件，减少重复代码

### 后端开发规范

- **框架**：使用 Hono 作为 Web 框架
- **数据库**：使用 Drizzle ORM 操作 PostgreSQL
- **路由组织**：API 路由 v2 版本，统一放置在 `route/` 目录
- **中间件**：所有中间件文件放置在 `middleware/` 目录
- **工具函数**：通用工具函数放置在 `utils/` 目录
- **类型定义**：TypeScript 类型定义放置在 `types/` 目录

### 前端开发规范

- **构建工具**：使用 Vite 作为前端构建工具
- **UI 组件**：使用 Shadcn UI + Tailwind CSS 构建界面
- **组件组织**：页面级组件放置在 `pages/` 目录，可复用组件放置在 `components/` 目录
- **状态管理**：使用 `jotai` 进行状态管理
- **网络请求**：使用 `web/src/utils/api.ts` 封装好的方法
- **国际化**：前端实现时必须考虑国际化支持
- **Tailwind CSS**：始终使用 Tailwind v4，不要使用 v3

### API 设计规范

- **设计原则**：严格遵循 RESTful API 设计原则
- **错误处理**：实现统一的错误处理机制和标准化响应格式
- **认证机制**：使用基于 API Key 的安全认证机制

## 开发流程

### 设置开发环境

1. **克隆项目**

   ```bash
   git clone https://github.com/Rabithua/Rote.git
   cd Rote
   ```

2. **安装依赖**

   ```bash
   # 后端
   cd server
   bun install

   # 前端
   cd web
   bun install
   ```

3. **配置环境变量**

   - 后端：在 `server/` 目录下创建 `.env` 文件，配置数据库连接：

     ```bash
     # 本地开发数据库连接字符串
     POSTGRESQL_URL=postgresql://rote:rote_password_123@localhost:5433/rote
     ```

     `POSTGRESQL_URL` 是 PostgreSQL 数据库连接字符串，格式为：
     `postgresql://用户名:密码@主机:端口/数据库名`

   - 前端：配置 `VITE_API_BASE` 环境变量（可选，默认使用 `http://localhost:18000`）

4. **启动开发数据库**

   使用 Docker 启动本地 PostgreSQL 数据库：

   ```bash
   cd server
   bun run db:start
   ```

   这会启动一个名为 `rote-postgres-local` 的 Docker 容器，数据库配置如下：

   - 用户：`rote`
   - 密码：`rote_password_123`
   - 数据库：`rote`
   - 端口：`5433`

   如果需要重置数据库，可以使用：

   ```bash
   bun run db:reset
   ```

5. **运行数据库迁移**

   首次启动时，需要运行数据库迁移。根据你的需求选择：

   **方式一：使用迁移文件（推荐，适用于首次设置）**

   ```bash
   cd server
   bun run db:migrate:programmatic
   ```

   或者使用 drizzle-kit CLI：

   ```bash
   bun run db:migrate
   ```

   **方式二：快速同步 schema（适用于开发时快速迭代）**

   ```bash
   bun run db:push
   ```

   > **注意**：`db:push` 会直接将 schema 同步到数据库，不生成迁移文件，适合开发环境快速迭代。生产环境应使用迁移文件方式。

6. **启动开发服务器**

   ```bash
   # 后端
   cd server
   bun run dev

   # 前端
   cd web
   bun run dev
   ```

### 提交规范

提交信息应该清晰描述更改内容，使用英文：

- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `style: Code formatting changes`
- `refactor: Code refactoring`
- `test: Add tests`
- `chore: Build/toolchain related`

## 测试

在提交 PR 之前，请确保：

- 代码通过 ESLint 检查：`bun run lint`
- 代码能够成功构建：
  - 后端：`cd server && bun run build`
  - 前端：`cd web && bun run build`
- 功能正常工作
- 没有破坏现有功能
- 响应式布局测试：如果涉及前端 UI 改动，请在不同屏幕尺寸下测试：
  - 移动端（手机）：320px - 768px
  - 平板：768px - 1024px
  - 桌面端：1024px 及以上
  - 确保界面在不同设备上正常显示，没有布局错乱或元素溢出

## 问题反馈

如果你在贡献过程中遇到任何问题，可以：

- 在 [Issues](https://github.com/Rabithua/Rote/issues) 中提问
- 查看项目文档了解更多信息

再次感谢你对 Rote 项目的贡献！
