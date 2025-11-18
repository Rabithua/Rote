# 从 Prisma 到 Drizzle 迁移开始指南

## 前提条件

✅ 数据库已恢复到迁移前的状态  
✅ Settings 表数据已恢复（当前有 6 条记录）  
✅ 所有表数据完整

## 迁移步骤

### 步骤 1: 最终备份（强烈推荐）

即使已经恢复，再次备份可以确保安全：

```bash
# 备份整个数据库
pg_dump $POSTGRESQL_URL > backup_before_drizzle_migration_$(date +%Y%m%d_%H%M%S).sql

# 或者只备份 settings 表（关键数据）
pg_dump $POSTGRESQL_URL -t settings > backup_settings_$(date +%Y%m%d_%H%M%S).sql
```

### 步骤 2: 检查当前数据库状态

```bash
cd server

# 检查 settings 表数据
bun run migrate:check-settings

# 检查整体数据库状态
bun run migrate:check
```

**预期结果：**

- Settings 表应该有数据（site, storage, security, notification, system, ui 等）
- 所有表结构应该正常

### 步骤 3: 执行迁移

运行统一的迁移脚本，它会自动处理所有必要的迁移步骤：

```bash
cd server
bun run migrate:complete
```

**此脚本会执行：**

1. ✅ **修复表结构**：为所有表的 UUID `id` 字段添加 `gen_random_uuid()` 默认值
2. ✅ **修复数据 null 值**：修复所有字段中的 null 值问题
3. ✅ **修复字段约束**：为 `rotes.archived` 等字段添加 NOT NULL 约束
4. ✅ **修复缺失索引**：创建 Drizzle schema 中定义但数据库中缺失的索引
5. ✅ **修复 collation 版本**：刷新数据库 collation 版本

**⚠️ 重要：** 此脚本**不会删除**任何数据，只会：

- 修复表结构（添加默认值、约束等）
- 修复数据中的 null 值（更新或删除无效记录）
- 不会删除 settings 表的数据

### 步骤 4: 验证迁移结果

```bash
# 检查 settings 表数据是否还在
bun run migrate:check-settings

# 验证迁移结果
bun run migrate:verify

# 检查数据库状态
bun run migrate:check
```

**验证要点：**

- ✅ Settings 表数据应该还在（6 条记录）
- ✅ 所有表的 UUID 字段应该有默认值
- ✅ 没有 null 值违反约束
- ✅ 所有约束都已正确添加

### 步骤 5: 测试应用功能

```bash
# 启动服务器
bun run dev

# 测试关键功能
# - 访问 /admin/settings 查看配置
# - 创建笔记测试
# - 测试其他核心功能
```

## 迁移过程中可能出现的问题

### 问题 1: UUID 默认值缺失

**症状：** `null value in column "id" violates not-null constraint`

**解决：** 迁移脚本会自动修复，如果仍有问题，手动运行：

```bash
bun run migrate:fix-structure
```

### 问题 2: Settings 表数据丢失

**症状：** Settings 表为空

**原因：**

- 运行了测试脚本（`test:init`、`test:quick`）
- 运行了 `db:push` 并重置了数据

**解决：**

1. 从备份恢复
2. 或重新初始化系统（访问 `/admin/setup`）

### 问题 3: Null 值违反约束

**症状：** 某些字段的 null 值导致错误

**解决：** 迁移脚本会自动修复，如果仍有问题，手动运行：

```bash
bun run migrate:data
```

## 迁移后的注意事项

1. **不要运行测试脚本**（除非在测试环境）
   - `test:init`、`test:quick` 会清空 settings 表
2. **谨慎使用 `db:push`**

   - 开发环境可以使用
   - 生产环境应使用 `db:migrate`

3. **定期备份**

   - 特别是 settings 表的数据
   - 建议在重要操作前备份

4. **验证迁移**
   - 迁移后立即验证所有功能
   - 检查关键数据是否完整

## 回滚方案

如果迁移出现问题，可以：

1. **从备份恢复**

   ```bash
   psql $POSTGRESQL_URL < backup_before_drizzle_migration_YYYYMMDD_HHMMSS.sql
   ```

2. **检查迁移日志**

   - 查看迁移脚本的输出
   - 检查是否有错误信息

3. **手动修复**
   - 根据错误信息手动修复
   - 或联系技术支持

## 成功标志

迁移成功的标志：

- ✅ 所有表结构正确（UUID 默认值、约束等）
- ✅ Settings 表数据完整（6 条记录）
- ✅ 没有 null 值违反约束
- ✅ 应用功能正常
- ✅ 可以正常创建新记录

## 需要帮助？

如果遇到问题：

1. 检查迁移脚本的输出日志
2. 运行 `bun run migrate:check` 查看数据库状态
3. 运行 `bun run migrate:check-settings` 检查 settings 表
4. 查看错误信息并参考本文档的"问题解决"部分
