# 附件排序功能更新文档

## 功能概述

为了提升用户体验，我们为附件功能添加了拖拽排序能力，用户可以通过拖拽来调整附件在笔记中的显示顺序。

## 更新内容

### 数据库变更

1. **添加排序字段**：

   - 在 `attachments` 表中添加了 `sortIndex` 字段（可选整数）
   - 添加了复合索引 `(roteid, sortIndex)` 以优化查询性能

2. **数据迁移**：
   - 为现有附件按创建时间顺序分配 `sortIndex` 值
   - 提供了迁移脚本 `/server/prisma/sql/update_sort_index.sql`

### 后端 API 更新

添加了新的 API 接口：

```
PUT /api/v2/attachments/sort
```

**请求参数**：

```json
{
  "roteId": "note-id",
  "attachmentIds": ["attachment-id-1", "attachment-id-2", "attachment-id-3"]
}
```

**功能说明**：

- 更新指定笔记的附件排序
- `attachmentIds` 数组的顺序即为新的排序顺序
- 系统会自动分配 `sortIndex` 值（从 0 开始递增）

### 前端界面更新

1. **拖拽排序**：

   - 使用 `@dnd-kit` 库实现拖拽功能
   - 支持鼠标和触摸设备操作
   - 实时预览排序效果

2. **状态管理**：

   - 本地状态实时更新，提供流畅的用户体验
   - 拖拽完成后自动调用排序 API 持久化
   - 失败时自动回滚到原排序

3. **视觉反馈**：
   - 拖拽时高亮显示目标位置
   - 提供拖拽手柄图标
   - 排序成功后显示提示信息

## 技术实现

### 数据库查询优化

- 所有附件查询默认按 `sortIndex` 排序
- 使用复合索引提高查询性能
- 兼容旧数据（`sortIndex` 为 null 的记录）

### 并发处理

- 上传文件时保持原始顺序，避免并发导致的排序错乱
- 使用索引值确保附件顺序的一致性

### 错误处理

- 排序 API 包含完整的验证逻辑
- 只能排序属于指定笔记的附件
- 提供详细的错误信息和状态反馈

## 兼容性

- **向后兼容**：现有附件继续正常显示，按创建时间排序
- **渐进增强**：新创建的附件支持排序功能
- **API 兼容**：原有的附件接口保持不变

## 使用指南

### 用户操作

1. 在笔记编辑器中，将鼠标悬停在附件上
2. 点击并拖拽附件到目标位置
3. 松开鼠标完成排序
4. 系统自动保存新的排序

### 开发者集成

```typescript
// 前端调用排序API
import { put } from "../utils/api";

const updateAttachmentSort = async (
  roteId: string,
  attachmentIds: string[]
) => {
  try {
    await put("/attachments/sort", { roteId, attachmentIds });
    console.log("排序更新成功");
  } catch (error) {
    console.error("排序更新失败:", error);
  }
};
```

## 性能优化

- 本地拖拽操作无网络延迟
- 批量更新减少 API 调用次数
- 数据库索引优化查询性能
- 幂等性设计避免重复操作

## 后续计划

- [ ] 支持批量拖拽多个附件
- [ ] 添加快捷键排序（上移/下移）
- [ ] 支持附件分组排序
- [ ] 移动端手势优化
