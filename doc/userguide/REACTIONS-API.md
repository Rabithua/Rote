## Reactions（反应）接口使用指南

本指南面向对接方，说明如何使用反应相关的接口为笔记添加或删除 emoji 反应。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api/reactions`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 所有接口支持可选认证，已登录用户使用 `Authorization: Bearer <accessToken>`，匿名访客需要提供 `visitorId`

### 反应说明

- 反应类型可以是任意 Unicode emoji 字符（如：👍、❤️、😊、🎉 等）
- 同一用户（已登录或匿名）可以对同一笔记添加多种不同的反应
- 同一用户对同一笔记的同一反应类型只能存在一个（重复添加会触发唯一约束冲突错误）
- 反应数据会自动包含在笔记详情中

---

### 1) 添加反应

- **方法**: POST
- **URL**: `/v2/api/reactions`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>`（可选，已登录用户）
- **Body**:
  - `type`: string（必填，反应类型，emoji 字符，最大 50 个字符）
  - `roteid`: string（必填，笔记 ID，UUID 格式）
  - `visitorId`: string（可选，访客设备指纹 ID，匿名用户必需，最大 200 个字符）
  - `visitorInfo`: object（可选，访客信息，如浏览器、操作系统等）
  - `metadata`: object（可选，附加元数据，如来源标识等）

**已登录用户请求示例（cURL）**:

```bash
curl -X POST 'https://your-domain.com/v2/api/reactions' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "👍",
    "roteid": "note-uuid",
    "metadata": {
      "source": "web"
    }
  }'
```

**匿名访客请求示例（cURL）**:

```bash
curl -X POST 'https://your-domain.com/v2/api/reactions' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "❤️",
    "roteid": "note-uuid",
    "visitorId": "fp_1234567890abcdef",
    "visitorInfo": {
      "browser": "Chrome",
      "os": "macOS",
      "device": "desktop"
    },
    "metadata": {
      "source": "web"
    }
  }'
```

成功响应示例（201）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "reaction-uuid",
    "type": "👍",
    "roteid": "note-uuid",
    "userid": "user-uuid",
    "visitorId": null,
    "visitorInfo": null,
    "metadata": {
      "source": "web"
    },
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

说明：

- 已登录用户：`userid` 字段有值，`visitorId` 为 `null`
- 匿名访客：`visitorId` 字段有值，`userid` 为 `null`
- 如果该用户已对该笔记添加过相同类型的反应，会触发唯一约束冲突错误

可能的错误：

- 400 缺少必需参数（`type` 或 `roteid`）
- 400 笔记 ID 格式错误（不是有效的 UUID）
- 400 匿名用户缺少 `visitorId`
- 400 反应类型超过 50 个字符
- 400 访客 ID 超过 200 个字符
- 404 笔记不存在
- 400/500 重复反应（唯一约束冲突）：该用户已对该笔记添加过相同类型的反应

---

### 2) 删除反应

- **方法**: DELETE
- **URL**: `/v2/api/reactions/:roteid/:type`
- **Headers**: `Authorization: Bearer <accessToken>`（可选，已登录用户）
- **路径参数**:
  - `roteid`: string（笔记 ID，UUID 格式）
  - `type`: string（反应类型，emoji 字符，需要进行 URL 编码）
- **Query 参数**:
  - `visitorId`: string（可选，访客设备指纹 ID，匿名用户必需）

**已登录用户请求示例（cURL）**:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/reactions/<NOTE_ID>/%F0%9F%91%8D' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

**匿名访客请求示例（cURL）**:

```bash
curl -X DELETE 'https://your-domain.com/v2/api/reactions/<NOTE_ID>/%E2%9D%A4%EF%B8%8F?visitorId=fp_1234567890abcdef'
```

说明：

- emoji 字符在 URL 中需要进行 URL 编码
- 例如：`👍` 编码为 `%F0%9F%91%8D`，`❤️` 编码为 `%E2%9D%A4%EF%B8%8F`

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 1
  }
}
```

说明：

- `count` 表示删除的反应数量（通常为 1，如果不存在则为 0）

可能的错误：

- 400 缺少必需参数
- 400 笔记 ID 格式错误
- 400 匿名用户缺少 `visitorId`

---

### 客户端使用建议

- **设备指纹生成**: 匿名访客需要生成唯一的设备指纹 ID（`visitorId`），建议使用设备特征（如浏览器指纹、设备 ID 等）生成，确保同一设备使用相同的指纹 ID
- **URL 编码**: 删除反应时，emoji 字符在 URL 路径中需要进行 URL 编码，建议使用标准库进行编码
- **反应类型**: 支持任意 Unicode emoji 字符，建议在客户端提供常用的 emoji 选择器
- **权限控制**: 当前实现不检查笔记的可见性状态（`state` 字段），任何知道笔记 ID 的用户都可以添加反应。删除反应时只能删除自己添加的反应（通过 `userid` 或 `visitorId` 匹配）
- **数据同步**: 反应数据会自动包含在笔记详情中，获取笔记详情时会返回该笔记的所有反应
- **重复添加**: 如果用户已对笔记添加过相同类型的反应，再次添加会触发唯一约束冲突错误。建议在客户端先检查是否已存在该反应，避免重复请求

---

### 获取笔记反应数据

反应数据会自动包含在笔记详情中，通过获取笔记详情接口（`GET /v2/api/notes/:id`）可以获取该笔记的所有反应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "note-uuid",
    "title": "笔记标题",
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
      "nickname": "演示用户",
      "avatar": "https://example.com/avatar.jpg"
    },
    "attachments": [],
    "reactions": [
      {
        "id": "reaction-uuid-1",
        "type": "👍",
        "roteid": "note-uuid",
        "userid": "user-uuid-1",
        "visitorId": null,
        "visitorInfo": null,
        "metadata": null,
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
      },
      {
        "id": "reaction-uuid-2",
        "type": "❤️",
        "roteid": "note-uuid",
        "userid": null,
        "visitorId": "fp_1234567890abcdef",
        "visitorInfo": {
          "browser": "Chrome",
          "os": "macOS"
        },
        "metadata": {
          "source": "web"
        },
        "createdAt": "2024-01-01T12:01:00.000Z",
        "updatedAt": "2024-01-01T12:01:00.000Z"
      }
    ]
  }
}
```

说明：

- `reactions` 数组包含该笔记的所有反应
- 每个反应包含反应类型、用户信息（已登录用户有 `userid`，匿名访客有 `visitorId`）和创建时间
- 客户端可以根据反应类型进行统计和展示
