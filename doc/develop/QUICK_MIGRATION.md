# 快速迁移指南

## 当前状态 ✅

根据检查结果：

- ✅ Settings 表数据完整（6 条记录）
- ✅ 所有表数据完整
- ✅ 关键字段无 null 值问题
- ⚠️ 需要修复表结构（UUID 默认值、约束等）

## 立即开始迁移

### 步骤 1: 最终备份（推荐）

```bash
# 备份整个数据库
pg_dump $POSTGRESQL_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
```

### 步骤 2: 执行迁移

```bash
cd server
bun run migrate:complete
```

**此命令会自动：**

1. ✅ 修复所有表的 UUID 默认值
2. ✅ 修复数据中的 null 值（如果需要）
3. ✅ 修复字段约束（如 `rotes.archived` NOT NULL）
4. ✅ 修复缺失的索引（性能优化）
5. ✅ 修复 collation 版本

**⚠️ 重要：** 此脚本**不会删除**任何数据，包括 settings 表的数据。

### 步骤 3: 验证迁移

```bash
# 检查 settings 表数据是否还在
bun run migrate:check-settings

# 验证迁移结果
bun run migrate:verify
```

**预期结果：**

- ✅ Settings 表仍有 6 条记录
- ✅ 所有表结构正确
- ✅ 没有约束错误

### 步骤 4: 测试应用

```bash
# 启动服务器
bun run dev

# 测试功能
# - 访问 /admin/settings 查看配置
# - 创建笔记测试
# - 测试其他核心功能
```

## 迁移完成标志

- ✅ Settings 表数据完整（6 条记录）
- ✅ 所有表 UUID 字段有默认值
- ✅ `rotes.archived` 有 NOT NULL 约束
- ✅ 应用功能正常

## 如果遇到问题

1. **Settings 表数据丢失**：从备份恢复
2. **UUID 默认值问题**：运行 `bun run migrate:fix-structure`
3. **约束错误**：运行 `bun run migrate:fix-archived`

## 完成！

迁移完成后，你的数据库就完全兼容 Drizzle ORM 了！🎉
