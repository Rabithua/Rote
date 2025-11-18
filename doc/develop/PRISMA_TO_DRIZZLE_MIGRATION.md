# 从 Prisma 到 Drizzle 生产环境迁移指南

## 概述

本文档详细说明如何将生产环境数据库从 Prisma ORM 结构安全迁移到 Drizzle ORM 结构。

## 迁移前准备

### 1. 环境要求

- 确保已安装 Bun 运行时
- 确保已配置 `POSTGRESQL_URL` 环境变量
- 确保有数据库管理员权限

### 2. 备份数据库

**⚠️ 重要：迁移前必须完整备份数据库！**

```bash
# 使用 pg_dump 备份数据库
pg_dump $POSTGRESQL_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 或者使用 PostgreSQL 客户端工具
pg_dump -h <host> -U <user> -d <database> -F c -f backup_$(date +%Y%m%d_%H%M%S).dump
```

**⚠️ 特别注意：**

- 如果运行了测试脚本（`test:init`、`test:quick` 等），会清空 `settings` 表的数据
- 如果运行了 `db:push`，可能会重置表结构或数据
- 迁移脚本不会删除 `settings` 表的数据，但如果数据丢失，需要重新初始化系统

**检查 settings 表数据：**

```bash
cd server
bun run migrate:check-settings
```

### 3. 检查当前数据库状态

运行检查脚本，了解当前数据库结构：

```bash
cd server
bun run scripts/migration/checkDatabaseState.ts
```

## 快速开始

**如果你已经恢复了数据库数据，想要开始迁移，请查看：**

👉 **[迁移开始指南](./MIGRATION_START_GUIDE.md)** - 详细的步骤说明

**快速迁移命令：**

```bash
cd server
bun run migrate:complete
```

---

## 迁移步骤

### 重要说明

**从 Prisma 迁移到 Drizzle 的特殊情况：**

标准的 Drizzle 迁移流程是：

1. 修改 `schema.ts`
2. 运行 `db:generate` 生成迁移文件
3. 运行 `db:migrate` 应用迁移

**但是**，从 Prisma 迁移到 Drizzle 时，数据库已经存在，且可能存在：

- 表结构差异（如缺少 UUID 默认值）
- 数据中的 null 值需要修复
- 约束差异（如缺少 NOT NULL）

在这种情况下，标准的 `db:push` 或 `db:migrate` 可能无法完全处理所有差异，特别是：

- 数据迁移（修复 null 值）
- 现有表结构的细微差异

因此，我们提供了专门的迁移脚本来处理这些特殊情况。

### 推荐迁移方式

**使用统一的迁移脚本（推荐）：**

```bash
cd server
bun run migrate:complete
```

此脚本会：

1. ✅ 修复表结构差异（UUID 默认值等）
2. ✅ 修复数据中的 null 值
3. ✅ 修复字段约束（NOT NULL 等）
4. ✅ 修复缺失的索引（性能优化）
5. ✅ 修复 collation 版本

### 标准 Drizzle 迁移方式（适用于日常开发）

**对于日常的 schema 变更，使用标准流程：**

```bash
cd server

# 1. 修改 schema.ts
# 2. 生成迁移文件
bun run db:generate

# 3. 检查迁移文件
cat drizzle/migrations/*.sql

# 4. 应用迁移（开发环境）
bun run db:push

# 或应用迁移文件（生产环境）
bun run db:migrate
```

**注意：** `db:push` 会直接同步 schema，适合开发环境。生产环境应使用 `db:migrate` 应用迁移文件。

```bash
cd server
bun run migrate:complete
```

此命令会执行以下步骤：

1. ✅ **修复表结构**：为所有表的 UUID `id` 字段添加 `gen_random_uuid()` 默认值
2. ✅ **修复数据 null 值**：修复所有字段中的 null 值问题
3. ✅ **修复字段约束**：为 `rotes.archived` 等字段添加 NOT NULL 约束
4. ✅ **修复缺失索引**：创建 Drizzle schema 中定义但数据库中缺失的索引
5. ✅ **修复 collation 版本**：刷新数据库 collation 版本

**预期输出：**

```
🚀 开始完整的 Prisma 到 Drizzle 迁移...

================================================================================
📋 步骤 1/5: 修复 UUID 默认值...
  ✓ users.id: 已有默认值
  ✓ rotes.id: 已有默认值
  ...
✅ UUID 默认值修复完成

📋 步骤 2/5: 修复数据中的 null 值...
  ✓ user_sw_subscriptions.keys: 无 null 值
  ✓ attachments.url: 无 null 值
  ...
✅ 数据 null 值修复完成

📋 步骤 3/5: 修复字段约束...
  ✓ rotes.archived: 已有 NOT NULL 约束
✅ 字段约束修复完成

📋 步骤 4/5: 修复缺失的索引...
  ✓ users_email_idx: 已存在
  ✅ user_settings_userid_idx: 已创建
  ...
✅ 索引修复完成（创建了 X 个索引）

📋 步骤 5/5: 修复 collation 版本...
  ✅ 已刷新数据库 collation 版本
✅ Collation 版本修复完成

================================================================================
📊 迁移总结:
✅ 修复 UUID 默认值
✅ 修复数据 null 值
✅ 修复字段约束
✅ 修复缺失索引
✅ 修复 collation 版本

总计: 5 个步骤
成功: 5 个
失败: 0 个

✨ 迁移完成！所有步骤都已成功执行。
   数据库现在应该可以正常使用 Drizzle ORM 了。
```

### 分步迁移（高级选项）

如果需要单独执行某个步骤，可以使用以下命令：

```bash
# 只修复表结构（UUID 默认值）
bun run migrate:fix-structure

# 只修复数据中的 null 值
bun run migrate:data

# 只修复 rotes.archived 字段约束
bun run migrate:fix-archived

# 只修复 collation 版本
bun run migrate:fix-collation
```

---

### 详细步骤说明（已废弃，请使用 migrate:complete）

<details>
<summary>点击展开详细步骤（不推荐，已整合到 migrate:complete）</summary>

#### 步骤 0: 修复表结构（如果遇到 UUID 默认值问题）

如果遇到 `null value in column "id" violates not-null constraint` 错误，说明表结构缺少 UUID 默认值。先运行结构修复脚本：

```bash
cd server
bun run migrate:fix-structure
```

此脚本会：

- 检查所有表的 UUID `id` 字段
- 为缺少 `gen_random_uuid()` 默认值的字段添加默认值
- 确保所有表都能正常插入新记录

**预期输出：**

```
🔍 检查所有表的 UUID id 字段默认值...

✅ 已确保 pgcrypto 扩展启用

✅ users.id: 已有正确的默认值
✅ user_settings.id: 已有正确的默认值
⚠️  rotes.id: 缺少 gen_random_uuid() 默认值
   当前默认值: NULL
✅ rotes.id: 修复成功
...

📊 修复报告:
总计: 9 个表
  已有默认值: 8 个
  需要修复: 1 个
  修复成功: 1 个
  修复失败: 0 个

✨ 所有表的 UUID id 字段默认值已修复完成！
```

### 步骤 1: 运行数据迁移脚本

修复可能存在的 null 值问题，为结构迁移做准备：

```bash
cd server
bun run migrate:data
```

此脚本会：

- 检查并修复 `user_sw_subscriptions.keys` 的 null 值
- 检查并修复 `attachments.url`、`storage`、`details` 的 null 值
- 检查并修复 `reactions.type` 的 null 值
- 检查并修复 `rotes.archived` 的 null 值
- 生成详细的迁移报告

**预期输出：**

```
🚀 开始数据迁移...

✅ user_sw_subscriptions.keys: 无 null 值
✅ attachments.url: 无 null 值
✅ attachments.storage: 无 null 值
✅ attachments.details: 无 null 值
✅ reactions.type: 无 null 值
✅ rotes.archived: 无 null 值

📊 迁移报告:
...
✅ 数据迁移完成！
```

### 步骤 1.5: 修复 rotes.archived 字段约束（可选但推荐）

在数据迁移完成后，为 `rotes.archived` 字段添加 NOT NULL 约束：

```bash
cd server
bun run migrate:fix-archived
```

此脚本会：

- 检查 `rotes.archived` 字段的当前状态
- 确保数据中没有 null 值（如有则修复）
- 添加 NOT NULL 约束
- 确保默认值为 false

**预期输出：**

```
🔍 检查 rotes.archived 字段状态...

当前字段信息:
  字段名: archived
  数据类型: boolean
  允许 null: 是
  默认值: false

✅ 数据中没有 null 值

🔧 添加 NOT NULL 约束...
✅ 已添加 NOT NULL 约束

📊 修复后的字段信息:
  允许 null: 否
  默认值: false

✅ 修复成功！rotes.archived 字段现在有 NOT NULL 约束。
```

### 步骤 2: 检查数据库结构差异

检查 Prisma 结构和 Drizzle 结构的差异：

```bash
cd server
bun run scripts/checkSchemaDifferences.ts
```

### 步骤 3: 生成迁移文件

如果数据库结构需要变更，生成迁移文件：

```bash
cd server
bun run db:generate
```

**注意：** 如果数据库已经是 Drizzle 结构，此步骤可能不会生成新文件。

### 步骤 4: 检查生成的迁移文件

仔细检查生成的迁移文件，确保：

1. **约束变更正确**：NOT NULL 约束的添加顺序正确
2. **索引创建正确**：新增索引不会与现有索引冲突
3. **外键约束正确**：外键关系保持一致
4. **数据安全**：不会导致数据丢失

```bash
# 查看迁移文件
cat server/drizzle/migrations/*.sql
```

### 步骤 5: 在测试环境验证

**强烈建议：** 先在测试环境（与生产环境结构相同的数据库）验证迁移：

```bash
# 1. 设置测试数据库连接
export POSTGRESQL_URL="postgresql://user:password@host:port/test_database"

# 2. 恢复生产数据库备份到测试环境
psql $POSTGRESQL_URL < backup_YYYYMMDD_HHMMSS.sql

# 3. 运行数据迁移脚本
bun run scripts/migration/migrateDataForDrizzle.ts

# 4. 应用结构迁移
bun run db:migrate

# 5. 验证数据库结构
bun run db:studio

# 6. 运行测试
bun run test:quick
```

### 步骤 6: 生产环境迁移

确认测试环境迁移成功后，执行生产环境迁移：

#### 6.1 维护窗口

- **建议在低峰期执行迁移**
- **通知用户可能的短暂服务中断**
- **准备回滚方案**

#### 6.2 执行迁移

```bash
# 1. 切换到生产环境
export POSTGRESQL_URL="<生产环境数据库连接>"

# 2. 再次备份（迁移前最后备份）
pg_dump $POSTGRESQL_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 3. 运行数据迁移脚本
bun run scripts/migration/migrateDataForDrizzle.ts

# 4. 应用结构迁移
bun run db:migrate

# 5. 验证迁移结果
bun run scripts/migration/verifyMigration.ts
```

#### 6.3 验证迁移结果

```bash
# 检查数据库结构
bun run db:studio

# 检查关键表的数据完整性
psql $POSTGRESQL_URL -c "SELECT COUNT(*) FROM users;"
psql $POSTGRESQL_URL -c "SELECT COUNT(*) FROM rotes;"
psql $POSTGRESQL_URL -c "SELECT COUNT(*) FROM attachments;"

# 检查约束
psql $POSTGRESQL_URL -c "
SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('user_sw_subscriptions', 'attachments', 'reactions', 'rotes')
  AND column_name IN ('keys', 'url', 'storage', 'details', 'type', 'archived')
ORDER BY table_name, column_name;
"
```

### 步骤 7: 更新应用代码

确保应用代码已更新为使用 Drizzle：

```bash
# 检查是否还有 Prisma 引用
grep -r "PrismaClient\|@prisma/client" server/ --exclude-dir=node_modules

# 应该没有输出，如果有，需要更新相关代码
```

### 步骤 8: 重启服务

```bash
# 重启应用服务
# 根据你的部署方式执行相应命令
# 例如：docker-compose restart rote-backend
# 或：systemctl restart rote-backend
```

### 步骤 9: 监控和验证

迁移后监控：

1. **应用日志**：检查是否有数据库相关错误
2. **性能指标**：监控查询性能
3. **功能测试**：测试关键功能是否正常

```bash
# 运行快速测试
bun run test:quick

# 检查应用日志
tail -f /var/log/rote-backend.log
```

## 回滚方案

如果迁移出现问题，按以下步骤回滚：

### 1. 停止应用服务

```bash
# 停止应用
docker-compose stop rote-backend
# 或
systemctl stop rote-backend
```

### 2. 恢复数据库备份

```bash
# 恢复备份
psql $POSTGRESQL_URL < backup_before_migration_YYYYMMDD_HHMMSS.sql

# 或使用 pg_restore
pg_restore -d $POSTGRESQL_URL backup_YYYYMMDD_HHMMSS.dump
```

### 3. 恢复应用代码

如果应用代码已更新，需要回滚到使用 Prisma 的版本：

```bash
git checkout <previous-commit-hash>
```

### 4. 重启服务

```bash
docker-compose start rote-backend
# 或
systemctl start rote-backend
```

## 常见问题

### 问题 1: 迁移失败 - 约束冲突

**错误信息：**

```
ERROR: column "keys" contains null values
```

**解决方案：**

1. 检查数据迁移脚本是否已运行
2. 手动修复 null 值：
   ```sql
   UPDATE user_sw_subscriptions SET keys = '{}'::jsonb WHERE keys IS NULL;
   ```
3. 重新运行迁移

### 问题 2: 索引已存在

**错误信息：**

```
ERROR: relation "users_email_idx" already exists
```

**解决方案：**
迁移文件使用了 `CREATE INDEX IF NOT EXISTS`，通常不会出现此问题。如果出现，可以手动删除旧索引：

```sql
DROP INDEX IF EXISTS users_email_idx;
```

然后重新运行迁移。

### 问题 3: 外键约束冲突

**错误信息：**

```
ERROR: insert or update on table "attachments" violates foreign key constraint
```

**解决方案：**

1. 检查数据完整性
2. 修复或删除无效的外键引用
3. 重新运行迁移

### 问题 4: 迁移文件不匹配

**错误信息：**

```
Migration file does not match database state
```

**解决方案：**

1. 检查迁移历史表：`SELECT * FROM drizzle.__drizzle_migrations;`
2. 手动标记已应用的迁移（如果需要）
3. 或使用 `db:push` 强制同步（仅开发环境）

## 迁移检查清单

迁移前检查：

- [ ] 数据库已完整备份
- [ ] 测试环境迁移已验证
- [ ] 数据迁移脚本已运行并成功
- [ ] 迁移文件已检查
- [ ] 维护窗口已安排
- [ ] 回滚方案已准备
- [ ] 团队已通知

迁移后检查：

- [ ] 数据库结构验证通过
- [ ] 数据完整性检查通过
- [ ] 应用功能测试通过
- [ ] 性能指标正常
- [ ] 应用日志无错误
- [ ] 用户反馈正常

## 迁移时间估算

- **数据迁移脚本**：5-15 分钟（取决于数据量）
- **结构迁移**：1-5 分钟
- **验证测试**：10-20 分钟
- **总计**：约 20-40 分钟

## 联系支持

如果遇到问题，请：

1. 检查本文档的"常见问题"部分
2. 查看应用日志和数据库日志
3. 联系技术支持团队

## 附录

### A. 迁移脚本位置

- 数据迁移脚本：`server/scripts/migration/migrateDataForDrizzle.ts`
- 检查脚本：`server/scripts/migration/checkDatabaseState.ts`
- 验证脚本：`server/scripts/migration/verifyMigration.ts`

### B. 相关文档

- [数据库迁移操作指导](./DATABASE-MIGRATION-GUIDE.md)
- [Drizzle Schema 定义](../server/drizzle/schema.ts)
- [Prisma Schema 定义](../server/prisma/schema.prisma)
