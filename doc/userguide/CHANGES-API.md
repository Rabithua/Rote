## Changes（变更记录）接口使用指南

本指南面向对接方，说明如何使用变更记录相关的接口进行笔记变更历史的查询和同步。仅包含使用方法与示例，不涉及实现细节。

### 基础信息
- **基础路径**: `/v2/api/changes`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 所有接口都需要认证，加请求头 `Authorization: Bearer <accessToken>`

### 变更记录说明
变更记录用于追踪笔记的创建、更新、删除操作，主要用于客户端同步场景。

**变更记录字段**：
- `id`: 变更记录ID（UUID）
- `originid`: 原始笔记ID（用于客户端同步，即使笔记被删除也保留）
- `roteid`: 笔记ID（可能为 `null`，如果笔记被删除）
- `action`: 操作类型，可选值：`"CREATE"`（创建）、`"UPDATE"`（更新）、`"DELETE"`（删除）
- `userid`: 用户ID
- `createdAt`: 变更时间
- `rote`: 关联的笔记信息（如果笔记存在，包含笔记的详细信息）

---

### 1) 根据原始笔记ID获取变更记录
- **方法**: GET
- **URL**: `/v2/api/changes/origin/:originid`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **路径参数**:
  - `originid`: string（原始笔记ID，UUID格式）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/changes/origin/<ORIGIN_ID>?skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "change-uuid",
      "originid": "origin-uuid",
      "roteid": "rote-uuid",
      "action": "UPDATE",
      "userid": "user-uuid",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "rote": {
        "id": "rote-uuid",
        "title": "笔记标题",
        "content": "笔记内容",
        "type": "Rote",
        "tags": ["标签1"],
        "state": "public",
        "archived": false,
        "pin": false,
        "editor": "normal",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    }
  ]
}
```

说明：
- 返回结果按创建时间降序排列（最新的在前）
- 只返回当前登录用户的变更记录
- 如果笔记被删除，`rote` 字段可能为 `null`，但 `originid` 仍然保留

可能的错误：
- 401 未认证（需要登录）
- 400 原始笔记ID格式错误或缺失

---

### 2) 根据笔记ID获取变更记录
- **方法**: GET
- **URL**: `/v2/api/changes/rote/:roteid`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **路径参数**:
  - `roteid`: string（笔记ID，UUID格式）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/changes/rote/<ROTE_ID>?skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "change-uuid",
      "originid": "origin-uuid",
      "roteid": "rote-uuid",
      "action": "CREATE",
      "userid": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "rote": {
        "id": "rote-uuid",
        "title": "笔记标题",
        "content": "笔记内容",
        "type": "Rote",
        "tags": ["标签1"],
        "state": "public",
        "archived": false,
        "pin": false,
        "editor": "normal",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

说明：
- 返回结果按创建时间降序排列（最新的在前）
- 只返回当前登录用户的变更记录
- 如果笔记被删除，`roteid` 可能为 `null`，此时不会返回该变更记录

可能的错误：
- 401 未认证（需要登录）
- 400 笔记ID格式错误或缺失

---

### 3) 根据用户ID获取变更记录
- **方法**: GET
- **URL**: `/v2/api/changes/user`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `action`: string（可选，过滤操作类型：`"CREATE"`、`"UPDATE"`、`"DELETE"`）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/changes/user?skip=0&limit=20&action=UPDATE' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "change-uuid",
      "originid": "origin-uuid",
      "roteid": "rote-uuid",
      "action": "UPDATE",
      "userid": "user-uuid",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "rote": {
        "id": "rote-uuid",
        "title": "笔记标题",
        "content": "笔记内容",
        "type": "Rote",
        "tags": ["标签1"],
        "state": "public",
        "archived": false,
        "pin": false,
        "editor": "normal",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    }
  ]
}
```

说明：
- 返回当前登录用户的所有变更记录
- 返回结果按创建时间降序排列（最新的在前）
- 可以通过 `action` 参数过滤特定类型的操作

可能的错误：
- 401 未认证（需要登录）

---

### 4) 获取指定时间戳之后的变更记录
- **方法**: GET
- **URL**: `/v2/api/changes/after`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `timestamp`: string（必填，时间戳，支持多种格式）
  - `skip`: number（可选，分页偏移量）
  - `limit`: number（可选，每页数量）
  - `action`: string（可选，过滤操作类型：`"CREATE"`、`"UPDATE"`、`"DELETE"`）

**时间戳格式支持**：
- ISO 8601 格式：`"2024-01-01T00:00:00.000Z"` 或 `"2024-01-01T00:00:00Z"`
- Unix 时间戳（秒）：`"1704067200"`
- Unix 时间戳（毫秒）：`"1704067200000"`

请求示例（cURL）:

```bash
# 使用 ISO 8601 格式
curl -X GET 'https://your-domain.com/v2/api/changes/after?timestamp=2024-01-01T00:00:00.000Z&skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

# 使用 Unix 时间戳（秒）
curl -X GET 'https://your-domain.com/v2/api/changes/after?timestamp=1704067200&skip=0&limit=20' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "change-uuid-1",
      "originid": "origin-uuid-1",
      "roteid": "rote-uuid-1",
      "action": "CREATE",
      "userid": "user-uuid",
      "createdAt": "2024-01-01T01:00:00.000Z",
      "rote": {
        "id": "rote-uuid-1",
        "title": "笔记标题1",
        "content": "笔记内容1",
        "type": "Rote",
        "tags": ["标签1"],
        "state": "public",
        "archived": false,
        "pin": false,
        "editor": "normal",
        "createdAt": "2024-01-01T01:00:00.000Z",
        "updatedAt": "2024-01-01T01:00:00.000Z"
      }
    },
    {
      "id": "change-uuid-2",
      "originid": "origin-uuid-2",
      "roteid": "rote-uuid-2",
      "action": "UPDATE",
      "userid": "user-uuid",
      "createdAt": "2024-01-01T02:00:00.000Z",
      "rote": {
        "id": "rote-uuid-2",
        "title": "笔记标题2",
        "content": "笔记内容2",
        "type": "Rote",
        "tags": ["标签2"],
        "state": "private",
        "archived": false,
        "pin": false,
        "editor": "normal",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T02:00:00.000Z"
      }
    }
  ]
}
```

说明：
- 返回指定时间戳之后的所有变更记录（不包含该时间戳）
- 返回结果按创建时间升序排列（最早的在前），方便客户端按顺序处理
- 只返回当前登录用户的变更记录
- 可以通过 `action` 参数过滤特定类型的操作
- 如果使用 ISO 8601 格式且包含特殊字符，需要进行 URL 编码

可能的错误：
- 401 未认证（需要登录）
- 400 时间戳参数缺失或格式错误

---

### 客户端使用建议
- **同步场景**: 使用 `/changes/after` 接口配合时间戳，可以实现增量同步。客户端记录最后一次同步的时间戳，定期调用该接口获取新的变更记录
- **时间戳格式**: 推荐使用 ISO 8601 格式（`YYYY-MM-DDTHH:mm:ss.sssZ`），如果使用 Unix 时间戳，注意区分秒和毫秒
- **分页处理**: 所有查询接口都支持 `skip` 和 `limit` 参数，建议合理设置每页数量，避免一次性加载过多数据
- **操作类型过滤**: 可以通过 `action` 参数过滤特定类型的操作，例如只获取创建或更新操作
- **originid vs roteid**: 
  - `originid` 是原始笔记ID，即使笔记被删除也保留，用于客户端同步场景
  - `roteid` 是当前笔记ID，如果笔记被删除，该字段可能为 `null`
- **笔记信息**: 变更记录中包含关联的笔记信息（`rote` 字段），如果笔记被删除，该字段可能为 `null`

