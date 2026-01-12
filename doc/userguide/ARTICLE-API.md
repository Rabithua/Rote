## Article（文章）接口使用指南

本指南面向对接方，说明如何使用 Article（文章）相关的接口进行文章的创建、查询、更新、删除等操作。文章可以与笔记进行一对一关联。

### 基础信息

- **基础路径**: `/v2/api/articles`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`

### 字段说明

- **id**: 文章 ID（UUID 格式）
- **content**: 文章内容（Markdown 格式，必填）
- **authorId**: 作者 ID（UUID 格式）
- **createdAt**: 创建时间（ISO 8601 格式）
- **updatedAt**: 更新时间（ISO 8601 格式）
- **author**: 作者信息对象（包含 `username`、`nickname`、`avatar`、`emailVerified`）
- **title**: 从 Markdown 内容解析的标题（计算字段，取第一个 `#` 标题）
- **summary**: 从 Markdown 内容解析的摘要（计算字段）

**说明**：`title` 和 `summary` 是从 `content` 字段自动解析的计算字段，不存储在数据库中。

---

### 1) 创建文章

- **方法**: POST
- **URL**: `/v2/api/articles/`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `content`: string（必填，Markdown 格式，最大 1,000,000 个字符）

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/articles/' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "# 文章标题\n\n这是文章的正文内容..."
  }'
```

成功响应示例（201）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "content": "# 文章标题\n\n这是文章的正文内容...",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "title": "文章标题",
    "summary": "这是文章的正文内容..."
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 内容为空
- 400 内容超过 1,000,000 个字符

---

### 2) 获取我的文章列表

- **方法**: GET
- **URL**: `/v2/api/articles/`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量，默认 0）
  - `limit`: number（可选，每页数量，默认 20）
  - `keyword`: string（可选，搜索关键词，在内容中模糊匹配）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/articles/?skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "a219cacc-1938-4540-880d-e03ddc96b390",
      "content": "# 文章标题\n\n这是文章的正文内容...",
      "authorId": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "title": "文章标题",
      "summary": "这是文章的正文内容..."
    }
  ]
}
```

可能的错误：

- 401 未认证（需要登录）

---

### 3) 获取文章详情

- **方法**: GET
- **URL**: `/v2/api/articles/:id`
- **Headers**: `Authorization: Bearer <accessToken>`（可选）
- **路径参数**:
  - `id`: string（文章 ID，UUID 格式）
- **Query 参数**:
  - `noteId`: string（可选，笔记 ID，非作者访问时必填）

**访问权限说明**：

- 作者可直接访问自己的文章，无需提供 `noteId`
- 非作者需要提供 `noteId` 参数，且该笔记必须：
  - 可被当前用户访问（公开笔记或用户自己的私有笔记）
  - 关联了该文章

请求示例（cURL）:

作者访问：

```bash
curl -X GET 'https://your-domain.com/v2/api/articles/<ARTICLE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

非作者访问（通过笔记上下文）：

```bash
curl -X GET 'https://your-domain.com/v2/api/articles/<ARTICLE_ID>?noteId=<NOTE_ID>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "content": "# 文章标题\n\n这是文章的完整内容...",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "title": "文章标题",
    "summary": "这是文章的完整内容...",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    }
  }
}
```

可能的错误：

- 404 文章不存在
- 400 非作者访问时缺少 noteId 参数
- 403 笔记为私有且非作者
- 403 文章未被指定笔记引用

---

### 4) 更新文章

- **方法**: PUT
- **URL**: `/v2/api/articles/:id`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **路径参数**:
  - `id`: string（文章 ID，UUID 格式）
- **Body**:
  - `content`: string（可选，Markdown 格式，最大 1,000,000 个字符）

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/articles/<ARTICLE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "# 更新后的标题\n\n更新后的文章内容..."
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "content": "# 更新后的标题\n\n更新后的文章内容...",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z",
    "title": "更新后的标题",
    "summary": "更新后的文章内容..."
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 403 无权限（只能更新自己的文章）
- 404 文章不存在
- 400 内容超过 1,000,000 个字符

---

### 5) 删除文章

- **方法**: DELETE
- **URL**: `/v2/api/articles/:id`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **路径参数**:
  - `id`: string（文章 ID，UUID 格式）

**说明**：删除文章后，所有关联该文章的笔记的 `articleId` 字段会自动设为 `null`（数据库外键级联）。

请求示例（cURL）:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/articles/<ARTICLE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "content": "# 文章标题\n\n这是文章的正文内容...",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 403 无权限（只能删除自己的文章）
- 404 文章不存在

---

### 6) 获取笔记关联的文章（卡片信息）

- **方法**: GET
- **URL**: `/v2/api/articles/by-note/:noteId`
- **Headers**: `Authorization: Bearer <accessToken>`（可选，访问私有笔记时需要）
- **路径参数**:
  - `noteId`: string（笔记 ID，UUID 格式）

**说明**：此接口返回笔记关联文章的摘要信息（不含完整内容），用于卡片展示。

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/articles/by-note/<NOTE_ID>'
```

成功响应示例（200）：

笔记有关联文章时：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "title": "文章标题",
    "summary": "这是文章的摘要...",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    }
  }
}
```

笔记没有关联文章时：

```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

可能的错误：

- 400 noteId 格式错误
- 403 笔记为私有且非作者

---

### 7) 更新笔记与文章的关联

- **方法**: POST
- **URL**: `/v2/api/articles/refs/:noteId`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **路径参数**:
  - `noteId`: string（笔记 ID，UUID 格式）
- **Body**:
  - `articleId`: string | null（可选，文章 ID，传 `null` 清除关联）
  - `articleIds`: string[]（可选，兼容旧客户端，取第一个元素）

**说明**：

- 每个笔记最多关联一篇文章（一对一关系）
- 优先使用 `articleId`，其次使用 `articleIds` 的第一个元素
- 传入 `null` 或空数组可清除关联
- 只能关联自己创建的文章

请求示例（cURL）:

绑定文章：

```bash
curl -X POST 'https://your-domain.com/v2/api/articles/refs/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "articleId": "a219cacc-1938-4540-880d-e03ddc96b390"
  }'
```

清除关联：

```bash
curl -X POST 'https://your-domain.com/v2/api/articles/refs/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "articleId": null
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "authorId": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "title": "文章标题",
    "summary": "这是文章的摘要...",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    }
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 noteId 格式错误
- 403 无权限（只能操作自己的笔记）
- 403 文章不属于当前用户

---

### 客户端使用建议

- **文章与笔记关系**: 每个笔记最多关联一篇文章（一对一关系），一篇文章可被多个笔记引用
- **访问控制**: 文章本身没有公开/私有状态，其访问权限取决于关联笔记的可见性
- **内容格式**: 文章内容使用 Markdown 格式，第一个 `#` 标题会被自动解析为 `title` 字段
- **分页查询**: 使用 `skip` 和 `limit` 参数实现分页
- **搜索功能**: 文章列表接口支持 `keyword` 参数进行内容模糊搜索
- **级联删除**: 删除文章时，关联笔记的 `articleId` 会自动设为 `null`
