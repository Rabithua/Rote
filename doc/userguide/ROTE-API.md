## Rote（笔记）接口使用指南

本指南面向对接方，说明如何使用 Rote（笔记）相关的接口进行笔记的创建、查询、更新、删除等操作。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api/notes`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`

### 字段说明

- **id**: 笔记 ID（UUID 格式）
- **title**: 笔记标题（可选）
- **type**: 笔记类型，可选值：`"Rote"`（默认）
- **tags**: 标签数组（可选）
- **content**: 笔记内容（必填）
- **state**: 笔记状态，可选值：`"public"`（公开）、`"private"`（私有）、`"archived"`（归档）
- **archived**: 是否归档（布尔值，可选，默认 `false`）
- **authorid**: 作者 ID（UUID 格式）
- **pin**: 是否置顶（布尔值，可选，默认 `false`）
- **editor**: 编辑器类型，可选值：`"normal"`（普通，默认）、`"noval"`（小说）
- **createdAt**: 创建时间（ISO 8601 格式）
- **updatedAt**: 更新时间（ISO 8601 格式）
- **attachmentIds**: 附件 ID 数组（可选，创建/更新时使用）
- **author**: 作者信息对象（包含 `username`、`nickname`、`avatar`、`emailVerified`）
- **attachments**: 附件数组，每个附件包含：
  - `id`: 附件 ID（UUID 格式）
  - `url`: 附件原始 URL
  - `compressUrl`: 压缩后的附件 URL（可选）
  - `storage`: 存储类型（如 `"R2"`）
  - `details`: 附件详细信息（JSON 对象，包含 `key`、`compressKey`、`width`、`height`、`size`、`mimeType` 等）
  - `sortIndex`: 排序索引（数字）
  - `userid`: 用户 ID（UUID 格式，可选）
  - `roteid`: 笔记 ID（UUID 格式，可选）
  - `createdAt`: 创建时间（ISO 8601 格式）
  - `updatedAt`: 更新时间（ISO 8601 格式）
- **reactions**: 反应数组，每个反应包含：
  - `id`: 反应 ID（UUID 格式）
  - `type`: 反应类型（emoji 字符，如 `"👍"`）
  - `userid`: 用户 ID（UUID 格式，已登录用户，可选）
  - `visitorId`: 访客设备指纹 ID（匿名用户，可选）
  - `visitorInfo`: 访客信息（JSON 对象，可选）
  - `roteid`: 笔记 ID（UUID 格式）
  - `metadata`: 附加元数据（JSON 对象，可选）
  - `createdAt`: 创建时间（ISO 8601 格式）
  - `updatedAt`: 更新时间（ISO 8601 格式）

- **linkPreviews**: 链接预览数组，每个预览包含：
  - `id`: 预览 ID（UUID 格式）
  - `url`: 链接 URL
  - `title`: 标题（可选）
  - `description`: 描述（可选）
  - `image`: 图片 URL（可选）
  - `siteName`: 站点名称（可选）
  - `contentExcerpt`: 内容摘要（可选）
  - `score`: 相关性评分（数字，可选）
  - `createdAt`: 创建时间（ISO 8601 格式）

- **articleId**: 关联文章 ID（UUID 格式，可选，创建/更新时使用）
- **article**: 关联的文章对象（可选，查询时返回）。包含：
  - `id`: 文章 ID（UUID 格式）
  - `content`: 原始 Markdown 内容
  - `createdAt`: 文章创建时间（ISO 8601 格式）
  - `updatedAt`: 文章更新时间（ISO 8601 格式）

**说明**：每个笔记最多关联一篇文章。笔记表中的 `articleId` 字段用于存储关联文章的 ID。更新该字段会记录到变更历史（CHANGES-API）中。

`article` 示例：

```json
{
  "article": {
    "id": "a219cacc-1938-4540-880d-e03ddc96b390",
    "content": "# 标题\n...",
    "createdAt": "2026-01-12T07:45:21.626Z",
    "updatedAt": "2026-01-12T07:45:21.626Z"
  }
}
```

获取文章全文：

- 作者：`GET /v2/api/articles/:articleId`
- 非作者（需要笔记上下文）：`GET /v2/api/articles/:articleId?noteId=<noteId>`

---

### 1) 创建笔记

- **方法**: POST
- **URL**: `/v2/api/notes/`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `content`: string（必填，最大 1,000,000 个字符）
  - `title`: string（可选，最大 200 个字符）
  - `type`: string（可选，默认 `"Rote"`）
  - `state`: string（可选，默认 `"private"`）
  - `editor`: string（可选）
  - `tags`: string[]（可选，每个标签最大 50 个字符，最多 20 个标签）
  - `pin`: boolean（可选）
  - `archived`: boolean（可选）
  - `attachmentIds`: string[]（可选）
  - `articleId`: string（可选，关联文章 ID，UUID 格式）

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/notes/' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "这是一条笔记内容",
    "title": "笔记标题",
    "state": "public",
    "tags": ["标签1", "标签2"],
    "pin": false
  }'
```

成功响应示例（201）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "title": "笔记标题",
    "type": "Rote",
    "tags": ["标签1", "标签2"],
    "content": "这是一条笔记内容",
    "state": "public",
    "archived": false,
    "authorid": "user-uuid",
    "articleId": null,
    "pin": false,
    "editor": "normal",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    },
    "attachments": [],
    "reactions": [],
    "linkPreviews": [],
    "article": null
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 内容为空或字段格式错误
- 400 标题超过 200 个字符
- 400 内容超过 1,000,000 个字符
- 400 标签超过长度限制（单个标签最大 50 个字符，最多 20 个标签）

---

### 2) 获取当前用户的笔记列表

- **方法**: GET
- **URL**: `/v2/api/notes/`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选，是否只显示归档笔记）
  - `tag`: string | string[]（可选，按标签过滤，支持 `tag` 或 `tag[]` 两种格式）
  - 其他过滤参数（如 `state`、`type` 等）

**标签过滤说明**：

- 支持 `tag` 和 `tag[]` 两种查询参数格式
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）
- 示例：`?tag=技术` 或 `?tag[]=技术&tag[]=前端`（返回同时包含"技术"和"前端"标签的笔记）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/?skip=0&limit=20&archived=false' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    }
  ]
}
```

可能的错误：

- 401 未认证（需要登录）

---

### 3) 获取笔记详情

- **方法**: GET
- **URL**: `/v2/api/notes/:id`
- **Headers**: `Authorization: Bearer <accessToken>`（可选，访问私有笔记时需要）
- **路径参数**:
  - `id`: string（笔记 ID，UUID 格式）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "title": "笔记标题",
    "type": "Rote",
    "tags": ["标签1"],
    "content": "笔记内容",
    "state": "public",
    "archived": false,
    "authorid": "user-uuid",
    "articleId": null,
    "pin": false,
    "editor": "normal",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    },
    "attachments": [
      {
        "id": "attachment-uuid",
        "url": "https://example.com/image.jpg",
        "compressUrl": "https://example.com/image-compress.jpg",
        "storage": "R2",
        "details": {
          "key": "attachments/image.jpg",
          "compressKey": "attachments/image-compress.jpg",
          "width": 1920,
          "height": 1080,
          "size": 1024000,
          "mimeType": "image/jpeg"
        },
        "sortIndex": 0,
        "userid": "user-uuid",
        "roteid": "uuid",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "reactions": [
      {
        "id": "reaction-uuid",
        "type": "👍",
        "userid": "user-uuid",
        "visitorId": null,
        "visitorInfo": null,
        "roteid": "uuid",
        "metadata": {
          "source": "web"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "linkPreviews": [
      {
        "id": "preview-uuid",
        "url": "https://example.com/article",
        "title": "Example Article",
        "description": "This is an example article.",
        "image": "https://example.com/image.jpg",
        "siteName": "Example Site",
        "contentExcerpt": "This is an example article...",
        "score": 80,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "article": null
  }
}
```

可能的错误：

- 404 笔记不存在
- 403 无权限访问（私有笔记且非作者）

---

### 4) 批量获取笔记

- **方法**: POST
- **URL**: `/v2/api/notes/batch`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（可选，访问私有笔记时需要）
  - `Content-Type: application/json`
- **Body**:
  - `ids`: string[]（必填，笔记 ID 数组，UUID 格式，最多 100 个）

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/notes/batch' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "ids": ["uuid1", "uuid2", "uuid3"]
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid1",
      "title": "笔记标题1",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "笔记内容1",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    },
    {
      "id": "uuid2",
      "title": "笔记标题2",
      "type": "Rote",
      "tags": ["标签2"],
      "content": "笔记内容2",
      "state": "private",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    }
  ]
}
```

**权限说明**：

- 公开笔记（`state: "public"`）：任何人都可以访问，无需认证
- 私有笔记（`state: "private"`）：只有作者可以访问，需要认证且必须是笔记的作者
- 如果请求中包含用户无权访问的笔记，这些笔记会被自动过滤，不会出现在响应结果中
- 如果请求的笔记 ID 不存在，也不会出现在响应结果中

可能的错误：

- 400 ids 参数缺失或格式错误（必须是非空数组）
- 400 包含无效的 UUID 格式
- 400 超过最大数量限制（最多 100 个）

---

### 5) 更新笔记

- **方法**: PUT
- **URL**: `/v2/api/notes/:id`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **路径参数**:
  - `id`: string（笔记 ID，UUID 格式）
- **Body**: 需要更新的字段（所有字段均为可选，长度限制与创建接口相同）
  - `content`: string（可选，最大 1,000,000 个字符）
  - `title`: string（可选，最大 200 个字符）
  - `type`: string（可选）
  - `state`: string（可选）
  - `editor`: string（可选）
  - `tags`: string[]（可选，每个标签最大 50 个字符，最多 20 个标签）
  - `pin`: boolean（可选）
  - `archived`: boolean（可选）
  - `attachmentIds`: string[]（可选）
  - `articleId`: string | null（可选，关联文章 ID，UUID 格式，传 `null` 清除关联）

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/notes/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "更新后的笔记内容",
    "title": "更新后的标题",
    "state": "public",
    "tags": ["新标签1", "新标签2"],
    "attachmentIds": ["attachment-uuid-1", "attachment-uuid-2"]
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "title": "更新后的标题",
    "type": "Rote",
    "tags": ["新标签1", "新标签2"],
    "content": "更新后的笔记内容",
    "state": "public",
    "archived": false,
    "authorid": "user-uuid",
    "articleId": null,
    "pin": false,
    "editor": "normal",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T01:00:00.000Z",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    },
    "attachments": [],
    "reactions": [],
    "linkPreviews": [],
    "article": null
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 403 无权限（只能更新自己的笔记）
- 404 笔记不存在
- 400 标题超过 200 个字符
- 400 内容超过 1,000,000 个字符
- 400 标签超过长度限制（单个标签最大 50 个字符，最多 20 个标签）
- 400 附件 ID 格式错误（必须是有效的 UUID）

---

### 6) 删除笔记

- **方法**: DELETE
- **URL**: `/v2/api/notes/:id`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **路径参数**:
  - `id`: string（笔记 ID，UUID 格式）

请求示例（cURL）:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/notes/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

可能的错误：

- 401 未认证（需要登录）
- 403 无权限（只能删除自己的笔记）
- 404 笔记不存在

---

### 7) 获取随机笔记

- **方法**: GET
- **URL**: `/v2/api/notes/random`
- **Headers**: `Authorization: Bearer <accessToken>`（可选，登录用户会返回自己的随机笔记，未登录返回公开随机笔记）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/random' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "title": "随机笔记标题",
    "type": "Rote",
    "tags": ["标签1"],
    "content": "随机笔记内容",
    "state": "public",
    "archived": false,
    "authorid": "user-uuid",
    "articleId": null,
    "pin": false,
    "editor": "normal",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "author": {
      "username": "demo",
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg",
      "emailVerified": true
    },
    "attachments": [],
    "reactions": [],
    "linkPreviews": [],
    "article": null
  }
}
```

---

### 8) 搜索当前用户的笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词，最大 200 个字符）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选，是否只搜索归档笔记）
  - `tag`: string | string[]（可选，按标签过滤，支持 `tag` 或 `tag[]` 两种格式）
  - 其他过滤参数（如 `state`、`type` 等）

**标签过滤说明**：

- 支持 `tag` 和 `tag[]` 两种查询参数格式
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/search?keyword=关键词&skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "包含关键词的笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    }
  ]
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 关键词参数缺失
- 400 搜索关键词超过 200 个字符

---

### 9) 搜索公开笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search/public`
- **Headers**: 无需认证
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词，最大 200 个字符）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `tag`: string | string[]（可选，按标签过滤，支持 `tag` 或 `tag[]` 两种格式）
  - 其他过滤参数（如 `type` 等）

**标签过滤说明**：

- 支持 `tag` 和 `tag[]` 两种查询参数格式
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/search/public?keyword=关键词&skip=0&limit=20'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "包含关键词的公开笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    }
  ]
}
```

可能的错误：

- 400 关键词参数缺失
- 400 搜索关键词超过 200 个字符

---

### 10) 搜索指定用户的公开笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search/users/:username`
- **Headers**: 无需认证
- **路径参数**:
  - `username`: string（用户名）
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词，最大 200 个字符）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选）
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数

**标签过滤说明**：

- 支持单个标签或多个标签（数组格式）
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/search/users/demo?keyword=关键词&skip=0&limit=20&tag=技术'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "包含关键词的笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "linkPreviews": [],
      "article": null
    }
  ]
}
```

可能的错误：

- 400 关键词参数缺失
- 400 搜索关键词超过 200 个字符
- 404 用户不存在

---

### 11) 获取用户公开笔记列表

- **方法**: GET
- **URL**: `/v2/api/notes/users/:username`
- **Headers**: 无需认证
- **路径参数**:
  - `username`: string（用户名）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选）
  - `tag`: string | string[]（可选，按标签过滤，支持 `tag` 或 `tag[]` 两种格式）
  - 其他过滤参数（如 `state`、`type` 等）

**标签过滤说明**：

- 支持 `tag` 和 `tag[]` 两种查询参数格式
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/users/demo?skip=0&limit=20'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "公开笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "article": null
    }
  ]
}
```

可能的错误：

- 404 用户不存在

---

### 12) 获取所有公开笔记

- **方法**: GET
- **URL**: `/v2/api/notes/public`
- **Headers**: 无需认证
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `tag`: string | string[]（可选，按标签过滤，支持 `tag` 或 `tag[]` 两种格式）
  - 其他过滤参数（如 `type` 等）

**标签过滤说明**：

- 支持 `tag` 和 `tag[]` 两种查询参数格式
- 多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/public?skip=0&limit=20'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "公开笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "演示用户",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "article": null
    }
  ]
}
```

---

### 客户端使用建议

- **权限控制**: 创建、更新、删除笔记需要认证，且只能操作自己的笔记
- **分页查询**: 使用 `skip` 和 `limit` 参数实现分页，建议每页数量不超过 100
- **标签过滤**: `tag` 参数支持单个字符串或字符串数组，支持 `tag` 或 `tag[]` 两种查询参数格式。多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）。示例：`?tag=技术` 或 `?tag[]=技术&tag[]=前端`
- **搜索功能**: 搜索接口支持关键词匹配，可结合标签和其他过滤条件使用
- **公开/私有**: 公开笔记（`state: "public"`）无需认证即可访问，私有笔记（`state: "private"`）仅作者可访问
