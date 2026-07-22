# 用户接口使用指南

本文档说明当前用户接口的请求方式、主要字段和响应结构。接口实现以
`server/route/v2/user.ts`、`server/utils/dbMethods/user*.ts` 和 `server/imports/` 为准。

## 基础信息

- 基础路径：`/v2/api/users`
- 鉴权方式：需要登录的接口使用 `Authorization: Bearer <accessToken>`
- JSON 请求需使用 `Content-Type: application/json`
- 除数据导出接口外，成功响应统一为：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- 错误响应通常为：

```json
{
  "code": 1,
  "message": "错误信息",
  "data": null
}
```

## 接口一览

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/v2/api/users/:username` | 否 | 获取公开用户信息 |
| `GET` | `/v2/api/users/me/profile` | 是 | 获取当前用户资料和登录方式 |
| `PUT` | `/v2/api/users/me/profile` | 是 | 更新当前用户资料 |
| `GET` | `/v2/api/users/me/settings` | 是 | 获取当前用户设置 |
| `PUT` | `/v2/api/users/me/settings` | 是 | 更新当前用户设置 |
| `GET` | `/v2/api/users/me/tags` | 是 | 获取当前用户标签统计 |
| `GET` | `/v2/api/users/me/heatmap` | 是 | 获取当前用户笔记热力图 |
| `GET` | `/v2/api/users/me/statistics` | 是 | 获取当前用户内容统计 |
| `GET` | `/v2/api/users/me/export` | 是 | 导出用户数据 |
| `POST` | `/v2/api/users/me/import/plan` | 是 | 预检需要导入的笔记 |
| `POST` | `/v2/api/users/me/import` | 是 | 导入用户数据 |
| `DELETE` | `/v2/api/users/me` | 是 | 删除当前用户账户 |

## 1. 获取公开用户信息

`GET /v2/api/users/:username`

路径参数：

- `username`：用户名。

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/demo'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "demo",
    "nickname": "Demo",
    "avatar": "https://example.com/avatar.jpg",
    "cover": "https://example.com/cover.jpg",
    "description": "用户简介",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "certified": true
  }
}
```

`nickname`、`avatar`、`cover` 和 `description` 可能为 `null`。`certified` 表示用户是否已认证。

可能的错误：

- `404`：用户不存在。

## 2. 获取当前用户资料

`GET /v2/api/users/me/profile`

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "certified": true,
    "email": "demo@example.com",
    "username": "demo",
    "nickname": "Demo",
    "description": "用户简介",
    "avatar": "https://example.com/avatar.jpg",
    "cover": "https://example.com/cover.jpg",
    "role": "user",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-07-23T00:00:00.000Z",
    "allowExplore": true,
    "hasPassword": true,
    "oauthBindings": [
      {
        "provider": "github",
        "providerId": "12345678",
        "providerUsername": "demo"
      }
    ]
  }
}
```

字段说明：

- `certified`：用户是否已认证。
- `allowExplore`：是否允许公开笔记出现在探索页。
- `hasPassword`：当前账户是否已设置本地密码。
- `oauthBindings`：账户绑定的 OAuth 登录方式；可以为空数组，也可以包含多个提供商。
- `oauthBindings[].providerUsername`：提供商用户名，可能为 `null`。

旧版的 `authProvider` 和 `authProviderId` 字段已移除。客户端应使用 `hasPassword` 和
`oauthBindings` 判断可用登录方式。

可能的错误：

- `401`：未认证或令牌无效。
- `404`：用户不存在。

## 3. 更新当前用户资料

`PUT /v2/api/users/me/profile`

请求体字段均为可选：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `username` | `string` | 1–20 个字符，只能包含字母、数字、下划线和连字符，且不能使用保留路由或已存在的用户名 |
| `nickname` | `string \| null` | 昵称；空字符串或 `null` 会清空字段 |
| `description` | `string \| null` | 个人简介；空字符串或 `null` 会清空字段 |
| `avatar` | `string \| null` | 头像 URL；空字符串或 `null` 会清空字段 |
| `cover` | `string \| null` | 封面 URL；空字符串或 `null` 会清空字段 |

请求示例：

```bash
curl -X PUT 'https://your-domain.com/v2/api/users/me/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "new-username",
    "nickname": "新昵称",
    "description": "新的个人简介",
    "avatar": "https://example.com/new-avatar.jpg",
    "cover": null
  }'
```

成功响应中的 `data` 为更新后的基础资料：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "demo@example.com",
    "username": "new-username",
    "nickname": "新昵称",
    "description": "新的个人简介",
    "avatar": "https://example.com/new-avatar.jpg",
    "cover": null,
    "role": "user",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-07-23T00:00:00.000Z"
  }
}
```

可能的错误：

- `400`：用户名格式、长度或保留字校验失败。
- `401`：未认证或令牌无效。
- `409`：用户名已被使用。

## 4. 获取当前用户设置

`GET /v2/api/users/me/settings`

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/settings' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "allowExplore": true
  }
}
```

`allowExplore` 默认为 `true`。设为 `false` 后，公开笔记仍可通过直接链接访问，但不会被纳入探索页。

## 5. 更新当前用户设置

`PUT /v2/api/users/me/settings`

请求体：

```json
{
  "allowExplore": false
}
```

请求示例：

```bash
curl -X PUT 'https://your-domain.com/v2/api/users/me/settings' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"allowExplore": false}'
```

成功响应中的 `data` 为更新后的完整设置。若没有传入可更新字段，接口不会修改数据，而是返回当前设置。

## 6. 获取用户标签统计

`GET /v2/api/users/me/tags`

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/tags' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "name": "标签1",
      "count": 10
    },
    {
      "name": "标签2",
      "count": 5
    }
  ]
}
```

结果按使用次数从高到低排列。

## 7. 获取用户热力图

`GET /v2/api/users/me/heatmap`

查询参数：

- `startDate`：必填，开始日期，建议使用 `YYYY-MM-DD`。
- `endDate`：必填，结束日期，建议使用 `YYYY-MM-DD`。

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/heatmap?startDate=2026-01-01&endDate=2026-12-31' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "2026-01-01": 3,
    "2026-01-02": 1
  }
}
```

键为 UTC 日期，值为当天创建的笔记数量。没有笔记的日期不会出现在结果中；整个区间没有数据时返回空对象。

可能的错误：

- `400`：缺少 `startDate` 或 `endDate`。
- `401`：未认证或令牌无效。

## 8. 获取用户统计信息

`GET /v2/api/users/me/statistics`

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/statistics' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roteCount": 100,
    "attachmentCount": 25,
    "articleCount": 8
  }
}
```

旧版字段 `noteCount` 和 `attachmentsCount` 已不再返回。

## 9. 导出用户数据

`GET /v2/api/users/me/export`

请求示例：

```bash
curl 'https://your-domain.com/v2/api/users/me/export' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -o user-data.json
```

此接口不使用统一响应包装，而是直接返回 JSON 文件：

```text
Content-Type: application/json
Content-Disposition: attachment; filename=demo-2026-07-23-12-00-00.json
```

导出文件结构：

```json
{
  "formatVersion": 2,
  "notes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "笔记标题",
      "type": "Rote",
      "tags": ["标签1"],
      "content": "笔记内容",
      "state": "private",
      "archived": false,
      "authorid": "10000000-0000-4000-8000-000000000001",
      "articleId": null,
      "pin": false,
      "editor": "normal",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "author": {
        "username": "demo",
        "nickname": "Demo",
        "avatar": "https://example.com/avatar.jpg"
      },
      "attachments": [],
      "reactions": [],
      "source": {
        "provider": "memos",
        "accountId": "account-1",
        "externalId": "memo-1"
      }
    }
  ],
  "articles": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "content": "# 文章标题\n\n文章正文",
      "authorId": "10000000-0000-4000-8000-000000000001",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

说明：

- `formatVersion` 当前为 `2`。
- `source` 只会出现在具有外部导入来源的笔记或附件上。
- 每条笔记还可能包含内联的 `article`、附件详情和反应详情。
- 导出的 v2 文件可直接作为导入接口的请求体。

## 10. 预检用户数据导入

`POST /v2/api/users/me/import/plan`

请求体与执行导入接口相同。该接口只做校验和查询，不写入笔记、文章或附件。

请求示例：

```bash
curl -X POST 'https://your-domain.com/v2/api/users/me/import/plan' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data-binary @user-data.json
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "noteIndexes": [0, 2, 3]
  }
}
```

`noteIndexes` 是请求体 `notes` 数组中需要执行导入的零基索引：

- `existingStrategy: "skip"` 时，已存在的笔记不会出现在列表中。
- `existingStrategy: "overwrite"` 时，所有笔记索引都会返回。
- 带 `source` 的笔记按 `provider + accountId + externalId` 判断是否存在；不带 `source` 的旧格式笔记按 `id` 判断。

## 11. 执行用户数据导入

`POST /v2/api/users/me/import`

### 11.1 顶层请求结构

```json
{
  "formatVersion": 2,
  "notes": [],
  "articles": [],
  "importOptions": {
    "existingStrategy": "skip",
    "visibilityStrategy": "preserve"
  }
}
```

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `formatVersion` | 推荐 | 当前版本为 `2`；省略时按兼容的旧格式处理 |
| `notes` | 是 | 笔记数组，最多 20,000 条 |
| `articles` | 否 | 文章数组，最多 5,000 条，默认为空数组 |
| `importOptions.existingStrategy` | 否 | `skip` 或 `overwrite`，默认 `skip` |
| `importOptions.visibilityStrategy` | 否 | `preserve` 或 `private`，默认 `preserve` |

`skip` 会保留已存在的笔记并把它们计入 `unchanged`；`overwrite` 会用请求数据更新已存在的笔记。
`private` 会强制导入笔记为私有，`preserve` 会保留请求中的 `state`，缺省时仍为私有。
`existingStrategy` 只控制笔记；同 ID 的已有文章会更新为本次请求中的内容。

### 11.2 笔记、文章和附件结构

最小笔记：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "笔记内容"
}
```

笔记支持以下字段：

- 必填：`id`（UUID）、`content`（string）。
- 可选：`title`、`type`、`tags`、`state`、`archived`、`articleId`、`pin`、`editor`、`createdAt`、`updatedAt`、`attachments`、`source`。
- 单条笔记最多包含 100 个标签和 500 个附件。
- `createdAt`、`updatedAt` 和 `source.sourceUpdatedAt` 使用 ISO 8601 日期时间字符串。

最小文章：

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "content": "# 文章内容"
}
```

文章还可包含 `createdAt` 和 `updatedAt`。笔记的 `articleId` 只有在文章属于当前用户时才会建立关联。

最小附件：

```json
{
  "url": "attachments/image.png",
  "storage": "R2",
  "details": {
    "key": "attachments/image.png",
    "size": 1024,
    "mimetype": "image/png"
  }
}
```

附件还可包含 `id`、`compressUrl`、`posterUrl`、`createdAt`、`updatedAt`、`sortIndex` 和 `source`。
`details` 必须是对象，并需符合对应存储类型的附件校验规则。

来源标识结构：

```json
{
  "provider": "memos",
  "accountId": "account-1",
  "externalId": "memo-1",
  "sourceUpdatedAt": "2026-07-23T00:00:00.000Z"
}
```

同一请求中不能包含重复的笔记来源标识，也不能在同一笔记内包含重复的附件来源标识。

### 11.3 请求与响应示例

```bash
curl -X POST 'https://your-domain.com/v2/api/users/me/import' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data-binary @user-data.json
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 2,
    "created": 1,
    "updated": 0,
    "unchanged": 1,
    "notes": {
      "total": 2,
      "created": 1,
      "updated": 0,
      "unchanged": 1
    },
    "articles": {
      "total": 1,
      "created": 1,
      "updated": 0
    },
    "attachments": {
      "total": 1,
      "created": 1,
      "updated": 0,
      "deleted": 0
    },
    "formatVersion": 2
  }
}
```

可能的错误：

- `400`：请求格式不符合导入协议。
- `401`：未认证或令牌无效。
- 导入内容引用了其他用户拥有的笔记、文章或附件时，请求会失败，不会取得其所有权。

## 12. 删除当前用户账户

`DELETE /v2/api/users/me`

本地密码账户必须提交当前密码：

```bash
curl -X DELETE 'https://your-domain.com/v2/api/users/me' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"password": "your-password"}'
```

未设置本地密码的账户不校验密码，但仍应发送一个 JSON 对象：

```bash
curl -X DELETE 'https://your-domain.com/v2/api/users/me' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "success": true
  }
}
```

此操作不可恢复。账户及其笔记、文章、设置、登录绑定、API 密钥、推送订阅和导入来源映射会被删除；
附件存储对象会安排删除，用户在其他笔记上的反应会保留但不再关联该用户。建议先调用导出接口备份数据。

可能的错误：

- `400`：本地密码账户未提供密码。
- `401`：未认证或令牌无效。
- 密码不正确时删除失败。

## 客户端使用建议

- 不要从旧字段 `authProvider` 推断登录方式，使用 `hasPassword` 和 `oauthBindings`。
- 导入前先调用 `/me/import/plan`，再迁移所需附件并分批调用 `/me/import`。
- 使用 `source` 标识外部数据，才能在重复导入时稳定识别同一条笔记或附件。
- 导出接口返回原始文件，其他接口返回统一响应对象，客户端解析时需区分。
- 删除账户不可恢复，应在客户端二次确认，并优先提示用户导出备份。
