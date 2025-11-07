## Rote（笔记）接口使用指南

本指南面向对接方，说明如何使用 Rote（笔记）相关的接口进行笔记的创建、查询、更新、删除等操作。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api/notes`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`

### 字段说明

- **state**: 笔记状态，可选值：`"public"`（公开）、`"private"`（私有）、`"archived"`（归档）
- **type**: 笔记类型，可选值：`"Rote"`
- **editor**: 编辑器类型，可选值：`"normal"`（普通）、`"noval"`（小说）
- **content**: 笔记内容（必填）
- **title**: 笔记标题（可选）
- **tags**: 标签数组（可选）
- **pin**: 是否置顶（布尔值，可选）
- **archived**: 是否归档（布尔值，可选）
- **attachmentIds**: 附件 ID 数组（可选）

---

### 1) 创建笔记

- **方法**: POST
- **URL**: `/v2/api/notes/`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `content`: string（必填）
  - `title`: string（可选）
  - `type`: string（可选，默认 `"Rote"`）
  - `state`: string（可选，默认 `"private"`）
  - `editor`: string（可选）
  - `tags`: string[]（可选）
  - `pin`: boolean（可选）
  - `archived`: boolean（可选）
  - `attachmentIds`: string[]（可选）

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
    "content": "这是一条笔记内容",
    "title": "笔记标题",
    "state": "public",
    "tags": ["标签1", "标签2"],
    "authorid": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 内容为空或字段格式错误

---

### 2) 获取当前用户的笔记列表

- **方法**: GET
- **URL**: `/v2/api/notes/`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选，是否只显示归档笔记）
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数（如 `state`、`type` 等）

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
      "content": "笔记内容",
      "title": "笔记标题",
      "state": "public",
      "tags": ["标签1"],
      "createdAt": "2024-01-01T00:00:00.000Z"
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
    "content": "笔记内容",
    "title": "笔记标题",
    "state": "public",
    "tags": ["标签1"],
    "authorid": "user-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
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
      "content": "笔记内容1",
      "title": "笔记标题1",
      "state": "public",
      "tags": ["标签1"],
      "authorid": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid2",
      "content": "笔记内容2",
      "title": "笔记标题2",
      "state": "private",
      "tags": ["标签2"],
      "authorid": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
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
- **Body**: 需要更新的字段（与创建接口字段相同）

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/notes/<NOTE_ID>' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "更新后的笔记内容",
    "title": "更新后的标题",
    "state": "public"
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "content": "更新后的笔记内容",
    "title": "更新后的标题",
    "state": "public"
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 403 无权限（只能更新自己的笔记）
- 404 笔记不存在

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
    "content": "随机笔记内容",
    "title": "随机笔记标题",
    "state": "public"
  }
}
```

---

### 8) 搜索当前用户的笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选，是否只搜索归档笔记）
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数（如 `state`、`type` 等）

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
      "content": "包含关键词的笔记内容",
      "title": "笔记标题",
      "state": "public"
    }
  ]
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 关键词参数缺失

---

### 9) 搜索公开笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search/public`
- **Headers**: 无需认证
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数（如 `type` 等）

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
      "content": "包含关键词的公开笔记内容",
      "title": "笔记标题",
      "state": "public"
    }
  ]
}
```

可能的错误：

- 400 关键词参数缺失

---

### 10) 搜索指定用户的公开笔记

- **方法**: GET
- **URL**: `/v2/api/notes/search/users/:username`
- **Headers**: 无需认证
- **路径参数**:
  - `username`: string（用户名）
- **Query 参数**:
  - `keyword`: string（必填，搜索关键词）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `archived`: boolean（可选）
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/notes/search/users/demo?keyword=关键词&skip=0&limit=20'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "content": "包含关键词的笔记内容",
      "title": "笔记标题",
      "state": "public"
    }
  ]
}
```

可能的错误：

- 400 关键词参数缺失
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
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数（如 `state`、`type` 等）

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
      "content": "公开笔记内容",
      "title": "笔记标题",
      "state": "public"
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
  - `tag`: string | string[]（可选，按标签过滤）
  - 其他过滤参数（如 `type` 等）

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
      "content": "公开笔记内容",
      "title": "笔记标题",
      "state": "public"
    }
  ]
}
```

---

### 客户端使用建议

- **权限控制**: 创建、更新、删除笔记需要认证，且只能操作自己的笔记
- **分页查询**: 使用 `skip` 和 `limit` 参数实现分页，建议每页数量不超过 100
- **标签过滤**: `tag` 参数支持单个字符串或字符串数组，多个标签时使用 `hasEvery` 逻辑（笔记需包含所有指定标签）
- **搜索功能**: 搜索接口支持关键词匹配，可结合标签和其他过滤条件使用
- **公开/私有**: 公开笔记（`state: "public"`）无需认证即可访问，私有笔记（`state: "private"`）仅作者可访问
