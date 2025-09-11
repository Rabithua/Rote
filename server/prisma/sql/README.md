# SQL Scripts

这个文件夹包含用于数据库维护和迁移的SQL脚本。

## 文件说明

- `update_sort_index.sql` - 为现有附件添加排序索引的数据迁移脚本

## 使用方法

这些SQL脚本通常用于数据库维护或手动迁移。在执行前请确保：

1. 备份数据库
2. 在测试环境中先验证脚本
3. 根据实际情况调整脚本内容

## 执行示例

### 方法一：使用 Prisma CLI（推荐）

```bash
# 在 server 目录下执行
cat ./prisma/sql/update_sort_index.sql | bun prisma db execute --stdin --schema=prisma/schema.prisma
```

### 方法二：直接连接数据库

```bash
# 连接到数据库并执行脚本
psql -d your_database -f update_sort_index.sql
```

**推荐使用方法一**，因为：

- 自动使用 Prisma 配置的数据库连接
- 无需手动配置数据库连接参数
- 与项目的数据库管理工具保持一致
