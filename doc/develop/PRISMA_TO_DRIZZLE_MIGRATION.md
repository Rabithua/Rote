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

### 3. 检查当前数据库状态

运行检查脚本，了解当前数据库结构：

```bash
cd server
bun run scripts/checkDatabaseState.ts
```

## 迁移步骤

### 步骤 1: 运行数据迁移脚本

首先修复可能存在的 null 值问题，为结构迁移做准备：

```bash
cd server
bun run scripts/migrateDataForDrizzle.ts
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
bun run scripts/migrateDataForDrizzle.ts

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
bun run scripts/migrateDataForDrizzle.ts

# 4. 应用结构迁移
bun run db:migrate

# 5. 验证迁移结果
bun run scripts/verifyMigration.ts
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

- 数据迁移脚本：`server/scripts/migrateDataForDrizzle.ts`
- 检查脚本：`server/scripts/checkDatabaseState.ts`
- 验证脚本：`server/scripts/verifyMigration.ts`

### B. 相关文档

- [数据库迁移操作指导](./DATABASE-MIGRATION-GUIDE.md)
- [Drizzle Schema 定义](../server/drizzle/schema.ts)
- [Prisma Schema 定义](../server/prisma/schema.prisma)
