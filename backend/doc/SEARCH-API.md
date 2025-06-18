# 搜索API文档

## 概述

新增的关键词搜索API允许在用户的笔记中进行全文搜索，支持搜索标题、内容和标签。

## API端点

### 1. 搜索当前用户的笔记

```
GET /api/v2/notes/search
```

**认证要求**: 需要登录

**查询参数**:

- `keyword` (必需): 搜索关键词
- `skip` (可选): 跳过的笔记数量，用于分页
- `limit` (可选): 返回的笔记数量限制，默认20
- `archived` (可选): 是否搜索已归档的笔记 (true/false)
- `tag` (可选): 按标签过滤 (支持多个标签)

**搜索范围**:

- 笔记标题 (不区分大小写)
- 笔记内容 (不区分大小写)
- 笔记标签 (精确匹配)

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "...",
      "title": "...",
      "content": "...",
      "tags": ["..."],
      "author": {...},
      "attachments": [...],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### 2. 搜索公开笔记

```
GET /api/v2/notes/search/public
```

**认证要求**: 无

**查询参数**:

- `keyword` (必需): 搜索关键词
- `skip` (可选): 跳过的笔记数量，用于分页
- `limit` (可选): 返回的笔记数量限制，默认20
- `tag` (可选): 按标签过滤

**搜索范围**: 所有公开状态的笔记

### 3. 搜索指定用户的公开笔记

```
GET /api/v2/notes/search/users/:username
```

**认证要求**: 无

**路径参数**:

- `username` (必需): 用户名

**查询参数**:

- `keyword` (必需): 搜索关键词
- `skip` (可选): 跳过的笔记数量，用于分页
- `limit` (可选): 返回的笔记数量限制，默认20
- `archived` (可选): 是否搜索已归档的笔记
- `tag` (可选): 按标签过滤

**搜索范围**: 指定用户的公开笔记

### 4. API密钥搜索

```
GET /api/v2/openkey/notes/search
```

**认证要求**: API密钥

**查询参数**:

- `keyword` (必需): 搜索关键词
- `skip` (可选): 跳过的笔记数量，用于分页
- `limit` (可选): 返回的笔记数量限制，默认20
- `archived` (可选): 是否搜索已归档的笔记
- `tag` (可选): 按标签过滤

**搜索范围**: API密钥拥有者的所有笔记

## 搜索特性

### 1. 多字段搜索

- **标题搜索**: 在笔记标题中进行不区分大小写的模糊匹配
- **内容搜索**: 在笔记内容中进行不区分大小写的模糊匹配
- **标签搜索**: 在笔记标签中进行精确匹配

### 2. 逻辑组合

搜索使用OR逻辑，即关键词在标题、内容或标签中任一匹配即返回该笔记。

### 3. 过滤组合

搜索结果可以与其他过滤条件组合：

- 标签过滤：`tag=技术&tag=前端`
- 归档状态：`archived=true`
- 其他自定义过滤参数

### 4. 排序规则

- **用户笔记**: 置顶笔记优先，然后按创建时间倒序
- **公开笔记**: 按创建时间倒序

## 使用示例

### 搜索包含"React"的个人笔记

```bash
GET /api/v2/notes/search?keyword=React&limit=10
```

### 搜索公开笔记中包含"JavaScript"且带有"教程"标签的笔记

```bash
GET /api/v2/notes/search/public?keyword=JavaScript&tag=教程
```

### 搜索用户"john"的公开笔记中包含"API"的内容

```bash
GET /api/v2/notes/search/users/john?keyword=API
```

## 错误响应

### 400 Bad Request

```json
{
  "code": 400,
  "message": "Keyword is required",
  "data": null
}
```

### 401 Unauthorized

```json
{
  "code": 401,
  "message": "Authentication required",
  "data": null
}
```

### 404 Not Found

```json
{
  "code": 404,
  "message": "Username not found",
  "data": null
}
```

## 性能考虑

1. **分页**: 建议使用`limit`参数控制返回结果数量，避免一次性返回过多数据
2. **索引**: 数据库已针对搜索字段建立适当的索引
3. **缓存**: 考虑在前端实现搜索结果缓存以提升用户体验

## 前端集成建议

### 实时搜索

```javascript
// 防抖搜索
const debounceSearch = debounce(async (keyword) => {
  if (keyword.length >= 2) {
    const results = await get('/notes/search', { keyword });
    setSearchResults(results.data);
  }
}, 300);
```

### 搜索历史

考虑在本地存储用户的搜索历史，提升用户体验。

### 高亮显示

在搜索结果中高亮显示匹配的关键词。
