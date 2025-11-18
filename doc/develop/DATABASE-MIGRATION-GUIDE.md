# 数据库迁移操作指导文档

## 概述

本文档详细说明 Rote 项目中数据库结构变更的标准操作流程，包括开发环境、生产环境的迁移管理，以及常见问题的解决方案。

**注意**：项目已从 Prisma ORM 迁移到 Drizzle ORM，所有迁移操作现在使用 Drizzle Kit。

## 数据库迁移操作流程

### 1. 开发环境操作

#### 1.1 修改数据库结构

```bash
# 1. 编辑 schema 文件
vim server/drizzle/schema.ts

# 2. 生成迁移文件
bun run db:generate

# 3. 应用迁移到开发数据库
bun run db:push

# 或者使用迁移模式（推荐用于生产环境）
bun run db:migrate
```

#### 1.2 验证迁移

```bash
# 检查迁移文件
ls -la server/drizzle/migrations/

# 测试应用功能
bun run dev

# 使用 Drizzle Studio 查看数据库
bun run db:studio
```

#### 1.3 重置开发数据库（如需要）

```bash
# 手动删除并重建数据库
# 注意：Drizzle 不提供自动重置命令，需要手动操作

# 1. 连接到数据库并删除表
psql $POSTGRESQL_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. 重新应用所有迁移
bun run db:push
```

### 2. 生产环境操作

#### 2.1 部署迁移

```bash
# 生产环境应用迁移
bun run db:migrate

# 或者使用 push 模式（直接同步 schema，不生成迁移文件）
bun run db:push
```

#### 2.2 验证部署

```bash
# 检查数据库结构
bun run db:studio

# 测试关键功能
bun run test:quick
```

### 3. Docker 部署流程

#### 3.1 Dockerfile 配置

```dockerfile
FROM oven/bun:latest
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production --frozen-lockfile

COPY . .

# 应用数据库迁移
RUN bun run db:migrate

EXPOSE 3000
CMD ["bun", "run", "start"]
```

#### 3.2 使用 docker-compose

```yaml
version: "3.8"
services:
  rote-backend:
    build:
      context: ./server
    environment:
      - POSTGRESQL_URL=postgresql://username:password@host:port/database
    ports:
      - "3000:3000"
    restart: unless-stopped
    # 确保数据库迁移在服务启动前完成
    command: ["sh", "-c", "bun run db:migrate && bun run start"]
```

## 常用命令参考

### 开发环境命令

```bash
# 生成迁移文件（基于 schema 变更）
bun run db:generate

# 直接推送 schema 到数据库（开发用，不生成迁移文件）
bun run db:push

# 应用迁移文件到数据库
bun run db:migrate

# 打开 Drizzle Studio（数据库可视化工具）
bun run db:studio
```

### 生产环境命令

```bash
# 应用迁移文件
bun run db:migrate

# 检查数据库结构（使用 Studio）
bun run db:studio
```

### 问题排查命令

```bash
# 查看迁移文件
cat server/drizzle/migrations/*.sql

# 使用 Drizzle Studio 查看数据库结构
bun run db:studio
```

## 最佳实践

### 1. 迁移命名规范

- Drizzle Kit 会自动生成迁移文件名
- 迁移文件包含时间戳和描述性名称
- 格式：`YYYYMMDDHHMMSS_description.sql`

### 2. 迁移大小控制

- 每次迁移只做一个小变更
- 避免复杂的大迁移
- 复杂变更拆分为多个小迁移

### 3. 测试策略

- 开发环境充分测试
- 生产环境部署前备份数据
- 准备回滚方案

### 4. 安全注意事项

- **不要**在生产环境使用 `db:push`（会直接修改数据库结构）
- **总是**先在开发环境测试迁移
- **总是**检查迁移文件后再部署
- **总是**在生产环境使用 `db:migrate` 应用迁移

## Schema 定义

### 文件位置

- Schema 定义：`server/drizzle/schema.ts`
- 迁移文件：`server/drizzle/migrations/`
- 配置文件：`server/drizzle.config.ts`

### Schema 修改示例

```typescript
// server/drizzle/schema.ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // 添加新字段
  avatar: text("avatar"),
  // ...
});
```

修改后运行：

```bash
bun run db:generate  # 生成迁移文件
bun run db:push      # 开发环境直接应用
```

## 常见问题解决

### 1. 迁移冲突

```bash
# 问题：迁移文件与数据库状态不匹配
# 解决方案：检查迁移文件，手动调整或重新生成
bun run db:generate
```

### 2. Schema 与数据库不一致

```bash
# 问题：schema.ts 与数据库结构不匹配
# 解决方案：使用 db:push 同步（仅开发环境）
bun run db:push
```

### 3. 回滚迁移

```bash
# 注意：Drizzle 不直接支持回滚，需要手动处理
# 1. 创建新的迁移文件，包含回滚 SQL
# 2. 手动编写回滚 SQL
# 3. 应用回滚迁移
bun run db:migrate
```

## 监控和维护

### 1. 迁移状态监控

```bash
# 查看迁移文件
ls -la server/drizzle/migrations/

# 使用 Drizzle Studio 查看数据库
bun run db:studio
```

### 2. 数据库结构验证

```bash
# 使用 Drizzle Studio 对比 schema 和数据库
bun run db:studio
```

### 3. 性能监控

```sql
-- 检查索引使用情况
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 紧急情况处理

### 1. 回滚迁移

```bash
# 注意：Drizzle 不直接支持回滚，需要手动处理
# 1. 创建新的迁移文件，包含回滚 SQL
# 2. 手动编写回滚 SQL
# 3. 应用回滚迁移
bun run db:migrate
```

### 2. 数据恢复

```bash
# 从备份恢复数据
# 1. 停止服务
# 2. 恢复数据库备份
# 3. 重新应用迁移
bun run db:migrate
```

## 从 Prisma 迁移到 Drizzle

项目已完成从 Prisma 到 Drizzle ORM 的迁移：

- **Schema 文件**：从 `prisma/schema.prisma` 迁移到 `server/drizzle/schema.ts`
- **迁移文件**：从 `prisma/migrations/` 迁移到 `server/drizzle/migrations/`
- **数据库连接**：从 `utils/prisma.ts` 迁移到 `utils/drizzle.ts`
- **查询 API**：从 Prisma Client 迁移到 Drizzle ORM

## 总结

数据库迁移是项目维护的重要环节，需要严格按照规范操作：

1. **开发环境**：使用 `db:generate` 生成迁移文件，使用 `db:push` 快速测试
2. **生产环境**：使用 `db:migrate` 安全部署迁移
3. **Docker 部署**：确保迁移在服务启动前完成
4. **监控维护**：定期检查迁移文件和数据库结构

遵循这些规范可以确保数据库变更的安全性和可追溯性。
