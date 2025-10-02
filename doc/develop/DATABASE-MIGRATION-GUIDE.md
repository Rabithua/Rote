# 数据库迁移操作指导文档

## 概述

本文档详细说明 Rote 项目中数据库结构变更的标准操作流程，包括开发环境、生产环境的迁移管理，以及常见问题的解决方案。

## 当前部署配置分析

### 服务部署迁移状态

**当前配置存在问题**：

- Dockerfile 中使用 `npm run dbSchemaUpdate`（即 `prisma db push --accept-data-loss`）
- 这种方式会跳过迁移历史，直接推送 schema 到数据库
- **不推荐用于生产环境**，因为会丢失迁移历史记录

### 建议的改进方案

```dockerfile
# 修改 Dockerfile 中的启动命令
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run start"]
```

## 数据库迁移操作流程

### 1. 开发环境操作

#### 1.1 修改数据库结构

```bash
# 1. 编辑 schema 文件
vim prisma/schema.prisma

# 2. 创建迁移文件并应用
bunx prisma migrate dev --name "描述变更内容"

# 示例：
bunx prisma migrate dev --name "add_user_avatar_field"
bunx prisma migrate dev --name "add_note_tags_index"
bunx prisma migrate dev --name "update_user_table_constraints"
```

#### 1.2 验证迁移

```bash
# 检查迁移状态
bunx prisma migrate status

# 验证数据库结构
bunx prisma db pull --print

# 测试应用功能
bun run dev
```

#### 1.3 重置开发数据库（如需要）

```bash
# 重置数据库并重新应用所有迁移
bunx prisma migrate reset

# 重新生成 Prisma Client
bunx prisma generate
```

### 2. 生产环境操作

#### 2.1 部署迁移

```bash
# 生产环境只应用迁移，不生成新文件
bunx prisma migrate deploy

# 生成 Prisma Client
bunx prisma generate
```

#### 2.2 验证部署

```bash
# 检查迁移状态
bunx prisma migrate status

# 测试关键功能
bun run scripts/testAdmin.ts
```

### 3. Docker 部署流程

#### 3.1 修改 Dockerfile（推荐）

```dockerfile
FROM node:lts-alpine
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /usr/src/app

# 安装 Bun
RUN npm install -g bun

COPY ["package.json", "bun.lockb", "./"]
RUN bun install --production --frozen-lockfile

COPY . .

# 生成 Prisma Client 并应用迁移
RUN bunx prisma generate
RUN bunx prisma migrate deploy

EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
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
      - DATABASE_URL=postgresql://username:password@host:port/database
    ports:
      - "3000:3000"
    restart: unless-stopped
    # 确保数据库迁移在服务启动前完成
    command: ["sh", "-c", "bunx prisma migrate deploy && bun run start"]
```

## 常用命令参考

### 开发环境命令

```bash
# 创建迁移
bunx prisma migrate dev --name "变更描述"

# 重置开发数据库
bunx prisma migrate reset

# 直接推送 schema（仅开发用）
bunx prisma db push

# 查看迁移状态
bunx prisma migrate status

# 生成 Prisma Client
bunx prisma generate
```

### 生产环境命令

```bash
# 部署迁移
bunx prisma migrate deploy

# 检查迁移状态
bunx prisma migrate status

# 解决迁移冲突
bunx prisma migrate resolve --applied "迁移名称"
```

### 问题排查命令

```bash
# 查看数据库结构
bunx prisma db pull --print

# 验证 schema
bunx prisma validate

# 查看迁移历史
bunx prisma migrate status --verbose
```

## 最佳实践

### 1. 迁移命名规范

- 使用描述性名称：`add_user_email_index`
- 使用动词开头：`add_`, `update_`, `remove_`, `create_`
- 避免使用：`fix_`, `temp_`, `test_`

### 2. 迁移大小控制

- 每次迁移只做一个小变更
- 避免复杂的大迁移
- 复杂变更拆分为多个小迁移

### 3. 测试策略

- 开发环境充分测试
- 生产环境部署前备份数据
- 准备回滚方案

### 4. 安全注意事项

- **不要**在生产环境使用 `prisma migrate dev`
- **不要**在生产环境使用 `prisma db push`
- **总是**先在开发环境测试迁移
- **总是**检查迁移状态后再部署

## 常见问题解决

### 1. 迁移漂移（Drift）问题

```bash
# 问题：数据库结构与迁移历史不匹配
# 解决方案：
bunx prisma migrate reset --force
bunx prisma migrate dev --name init
```

### 2. 迁移冲突

```bash
# 问题：迁移文件缺失但数据库已应用
# 解决方案：
bunx prisma migrate resolve --applied "迁移名称"
```

### 3. 生产数据库不为空

```bash
# 问题：P3005 错误
# 解决方案：
bunx prisma migrate resolve --applied "迁移名称"
bunx prisma migrate deploy
```

### 4. 基线化现有数据库

```bash
# 为现有生产数据库创建迁移基线
bunx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_baseline/migration.sql

bunx prisma migrate resolve --applied "baseline"
```

## 监控和维护

### 1. 迁移状态监控

```bash
# 定期检查迁移状态
bunx prisma migrate status

# 查看迁移历史
bunx prisma migrate status --verbose
```

### 2. 数据库结构验证

```bash
# 验证 schema 与数据库同步
bunx prisma db pull --print | diff prisma/schema.prisma -
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
# 注意：Prisma 不直接支持回滚，需要手动处理
# 1. 创建回滚迁移
bunx prisma migrate dev --name "rollback_previous_change"

# 2. 手动编写回滚 SQL
# 3. 应用回滚迁移
bunx prisma migrate deploy
```

### 2. 数据恢复

```bash
# 从备份恢复数据
# 1. 停止服务
# 2. 恢复数据库备份
# 3. 重新部署迁移
bunx prisma migrate deploy
```

## 总结

数据库迁移是项目维护的重要环节，需要严格按照规范操作：

1. **开发环境**：使用 `migrate dev` 创建和测试迁移
2. **生产环境**：使用 `migrate deploy` 安全部署迁移
3. **Docker 部署**：确保迁移在服务启动前完成
4. **监控维护**：定期检查迁移状态和数据库结构

遵循这些规范可以确保数据库变更的安全性和可追溯性。
