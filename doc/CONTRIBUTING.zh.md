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

1. **Fork 项目**（如果从外部仓库贡献）

2. **从 `develop` 分支创建功能分支**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/amazing-feature
   ```

3. **编写代码**，遵循项目的代码规范

4. **提交更改**，遵循提交信息规范

   ```bash
   git commit -m "feat: Add some amazing feature"
   ```

5. **保持分支同步**（定期与 develop 同步）

   ```bash
   git fetch origin
   git rebase origin/develop
   # 或使用 merge: git merge origin/develop
   ```

6. **推送到你的分支**

   ```bash
   git push origin feature/amazing-feature
   ```

7. **创建 Pull Request**，目标分支选择 `develop`
   - 提供清晰的更改描述
   - 如有相关 Issue，请引用
   - 确保所有检查通过（代码检查、测试等）

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

### Git 分支策略

Rote 使用简化的 Git Flow 工作流，适合多人协作开发：

```
main (生产就绪)
  ↑
develop (集成分支)
  ↑
feature/xxx (功能分支)
```

**分支类型：**

- **`main`**：生产就绪的代码。仅在进行充分测试后从 `develop` 合并。
- **`develop`**：持续开发的集成分支。所有功能分支合并到这里。
- **`feature/xxx`**：功能开发分支。从 `develop` 创建，合并回 `develop`。

**分支命名规范：**

- `feature/xxx` - 新功能（例如：`feature/add-s3-region-config`）
- `bugfix/xxx` - Bug 修复（例如：`bugfix/fix-login-error`）
- `hotfix/xxx` - 紧急生产修复（例如：`hotfix/security-patch`）
- `refactor/xxx` - 代码重构（例如：`refactor/optimize-api`）

**工作流程：**

1. 从 `develop` 创建功能分支：

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. 开发并提交你的更改

3. 保持分支与 `develop` 同步：

   ```bash
   git fetch origin
   git rebase origin/develop  # 或使用 git merge origin/develop
   ```

4. 推送分支并创建 Pull Request，目标分支选择 `develop`

5. 代码审查通过后，合并到 `develop`

6. 准备发布时，将 `develop` 合并到 `main`

**重要提示：**

- 不要直接提交到 `main` 或 `develop` 分支
- 新工作始终创建功能分支
- 保持功能分支专注于单一功能或修复
- 定期与 `develop` 同步，避免冲突
- 使用描述性的分支名称，清楚表明目的

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

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。提交信息应该清晰描述更改内容，使用英文：

**格式：**

```
<type>: <subject>

[可选 body]

[可选 footer]
```

**类型：**

- `feat`: 添加新功能
- `fix`: 修复 Bug
- `docs`: 仅文档更改
- `style`: 代码风格更改（格式化、缺少分号等）
- `refactor`: 代码重构，不改变功能
- `perf`: 性能改进
- `test`: 添加或更新测试
- `chore`: 构建过程、工具或依赖更新
- `ci`: CI/CD 配置更改

**示例：**

```bash
feat: add S3 region configuration support
fix: resolve login authentication error
docs: update API documentation for user endpoints
refactor: optimize database query performance
test: add unit tests for storage configuration
```

**最佳实践：**

- 使用祈使语气（"add" 而不是 "added" 或 "adds"）
- 主题行保持在 50 个字符以内
- 主题行首字母大写
- 主题行末尾不要使用句号
- 使用 body 说明"什么"和"为什么"，而不是"如何"

## Pull Request 流程

1. **创建 PR 之前：**

   - 确保你的分支与 `develop` 保持同步
   - 运行所有测试和代码检查
   - 验证你的更改按预期工作

2. **PR 描述应包含：**

   - 清晰的更改说明
   - 相关 Issue 编号（如有）
   - 截图（UI 更改时）
   - 测试说明
   - 破坏性更改（如有）

3. **代码审查：**

   - 处理所有审查意见
   - 保持讨论建设性
   - 根据反馈更新 PR

4. **批准后：**
   - 维护者将合并你的 PR
   - 你的功能将包含在下一个版本中

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
