## 用户接口使用指南

本指南面向对接方，说明如何使用用户相关的接口进行用户信息查询、个人资料管理、统计数据获取等操作。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api/users`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`

---

### 1) 获取用户信息（通过用户名）

- **方法**: GET
- **URL**: `/v2/api/users/:username`
- **Headers**: 无需认证
- **路径参数**:
  - `username`: string（用户名）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/demo'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "username": "demo",
    "nickname": "Demo",
    "avatar": "https://example.com/avatar.jpg",
    "cover": "https://example.com/cover.jpg",
    "description": "用户简介",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

- 404 用户不存在

---

### 2) 获取当前用户个人资料

- **方法**: GET
- **URL**: `/v2/api/users/me/profile`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "email": "demo@example.com",
    "username": "demo",
    "nickname": "Demo",
    "description": "用户简介",
    "avatar": "https://example.com/avatar.jpg",
    "cover": "https://example.com/cover.jpg",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 404 用户不存在

---

### 3) 更新当前用户个人资料

- **方法**: PUT
- **URL**: `/v2/api/users/me/profile`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `nickname`: string（可选，昵称）
  - `description`: string（可选，个人简介）
  - `avatar`: string（可选，头像 URL）
  - `cover`: string（可选，封面 URL）

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/users/me/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "nickname": "新昵称",
    "description": "新的个人简介",
    "avatar": "https://example.com/new-avatar.jpg",
    "cover": "https://example.com/new-cover.jpg"
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "email": "demo@example.com",
    "username": "demo",
    "nickname": "新昵称",
    "description": "新的个人简介",
    "avatar": "https://example.com/new-avatar.jpg",
    "cover": "https://example.com/new-cover.jpg",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

可能的错误：

- 401 未认证（需要登录）
- 400 字段格式错误

---

### 4) 获取用户标签

- **方法**: GET
- **URL**: `/v2/api/users/me/tags`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/tags' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": ["标签1", "标签2", "标签3"]
}
```

可能的错误：

- 401 未认证（需要登录）

---

### 5) 获取用户热力图数据

- **方法**: GET
- **URL**: `/v2/api/users/me/heatmap`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `startDate`: string（必填，开始日期，格式：YYYY-MM-DD）
  - `endDate`: string（必填，结束日期，格式：YYYY-MM-DD）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/heatmap?startDate=2024-01-01&endDate=2024-12-31' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "2024-01-01": 3,
    "2024-01-02": 1,
    "2024-01-05": 5,
    "2024-01-10": 2
  }
}
```

说明：返回对象中，键为日期（YYYY-MM-DD 格式），值为该日期创建的笔记数量。如果某个日期没有笔记，则不会出现在返回结果中。

可能的错误：

- 401 未认证（需要登录）
- 400 日期参数缺失或格式错误

---

### 6) 获取用户统计信息

- **方法**: GET
- **URL**: `/v2/api/users/me/statistics`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/statistics' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "noteCount": 100,
    "attachmentsCount": 25
  }
}
```

说明：

- `noteCount`: 用户创建的笔记总数
- `attachmentsCount`: 用户上传的附件总数

可能的错误：

- 401 未认证（需要登录）

---

### 7) 导出用户数据

- **方法**: GET
- **URL**: `/v2/api/users/me/export`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/export' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -o user-data.json
```

成功响应示例（200）：

响应头：

```
Content-Type: application/json
Content-Disposition: attachment; filename=demo-2024-01-01-12-00-00.json
```

响应体（JSON 格式）：

```json
{
  "notes": [
    {
      "id": "uuid",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "笔记内容",
      "state": "public",
      "archived": false,
      "authorid": "user-uuid",
      "pin": false,
      "editor": "normal",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "Demo",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": []
    }
  ]
}
```

说明：

- 返回 JSON 文件下载，文件名格式：`{username}-{YYYY-MM-DD-HH-mm-ss}.json`
- 包含用户的所有笔记数据，以及每条笔记的附件、反应等信息

可能的错误：

- 401 未认证（需要登录）

---

### 客户端使用建议

- **权限控制**: 获取和更新个人资料、标签、统计数据等接口需要认证，且只能操作当前登录用户的数据
- **用户信息查询**: 通过用户名查询用户信息无需认证，但返回的信息有限（不包含邮箱等敏感信息）
- **热力图数据**: 日期格式必须为 `YYYY-MM-DD`，建议在客户端进行格式验证
- **数据导出**: 导出接口返回文件下载，注意处理响应头中的 `Content-Disposition` 字段以获取正确的文件名
