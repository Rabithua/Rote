# 用户接口使用指南

本文档说明当前用户接口的请求方式、主要字段和响应结构。接口实现以
`server/route/v2/user.ts`、`server/utils/dbMethods/user*.ts` 和 `server/imports/` 为准。

## 基础信息

- 用户接口基础路径：`/v2/api/users`
- 远程附件迁移使用相关接口：`/v2/api/imports/attachments/migrate`
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
| `GET` | `/v2/api/users/:username` | 可选 | 获取 viewer-aware 的公开用户信息 |
| `GET` | `/v2/api/users/me/profile` | 是 | 获取当前用户资料和登录方式 |
| `PUT` | `/v2/api/users/me/profile` | 是 | 更新当前用户资料 |
| `GET` | `/v2/api/users/me/settings` | 是 | 获取当前用户设置 |
| `PUT` | `/v2/api/users/me/settings` | 是 | 更新当前用户设置 |
| `GET` | `/v2/api/users/me/tags` | 是 | 获取当前用户标签统计 |
| `GET` | `/v2/api/users/me/heatmap` | 是 | 获取当前用户笔记热力图 |
| `GET` | `/v2/api/users/me/statistics` | 是 | 获取当前用户内容统计 |
| `GET` | `/v2/api/users/me/export` | 是 | 导出用户数据 |
| `GET` | `/v2/api/users/me/blocks` | 是 | 获取当前账户的完整屏蔽列表 |
| `PUT` | `/v2/api/users/me/blocks/:targetUserId` | 是 | 幂等屏蔽目标账户 |
| `DELETE` | `/v2/api/users/me/blocks/:targetUserId` | 是 | 幂等解除屏蔽 |
| `POST` | `/v2/api/users/me/import/plan` | 是 | 预检需要导入的笔记 |
| `POST` | `/v2/api/imports/attachments/migrate` | 是 | 将一个远程附件迁移到当前用户的对象存储 |
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
    "certified": true,
    "viewerHasBlocked": false
  }
}
```

`nickname`、`avatar`、`cover` 和 `description` 可能为 `null`。`certified` 表示用户是否已认证。
登录请求还会返回 `viewerHasBlocked`：当前 viewer 屏蔽该用户时为 `true`，以便资料页提供解除操作；
如果目标用户屏蔽了 viewer，则统一返回 `404`，不会泄露屏蔽关系。匿名请求的
`viewerHasBlocked` 始终为 `false`。

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
- 导出文件的顶层结构与 v2 导入请求兼容，但只有恢复到原账户、且其中的附件 ID 仍归当前用户所有时，
  才能原样作为导入请求。对同一实例中的其他账户执行恢复，或在原账户已删除后恢复时，不得复用导出的
  附件 ID；应先将附件迁移或上传到目标账户，并用目标账户拥有的附件记录替换导出数据中的附件。
- 导入接口不会仅凭导出文件中的附件 URL 复制对象存储内容。

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

## 11. 迁移远程附件

`POST /v2/api/imports/attachments/migrate`

此相关接口用于把一个 HTTP/HTTPS 远程附件下载到当前用户的对象存储，并创建一条尚未绑定笔记的附件记录。
直接将远程 URL 提交给 `/users/me/import` 只会保存该 URL，不会下载或迁移文件。

请求体：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `attachment` | 是 | 一个符合下文附件结构的对象；`url` 必须是可访问的 HTTP/HTTPS URL |
| `migrationAuth` | 否 | 目前仅支持 `{ "provider": "memos", "baseUrl": "https://memos.example.com" }` |

迁移公开远程附件时可省略 `migrationAuth`。迁移需要认证的 Memos 附件时，还必须通过
`x-memos-access-token` 请求头传递 Memos 访问令牌；服务端只会向与 `baseUrl` 同源的地址发送该令牌。

Memos 请求示例：

```bash
curl -X POST 'https://your-domain.com/v2/api/imports/attachments/migrate' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -H 'x-memos-access-token: <MEMOS_ACCESS_TOKEN>' \
  -d '{
    "attachment": {
      "url": "https://memos.example.com/file/attachments/a/photo.png",
      "storage": "REMOTE",
      "details": {
        "mimetype": "image/png",
        "originalname": "photo.png"
      }
    },
    "migrationAuth": {
      "provider": "memos",
      "baseUrl": "https://memos.example.com"
    }
  }'
```

成功时返回 `201`，`data` 是由当前用户拥有的新附件记录：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "url": "https://storage.example.com/users/10000000-0000-4000-8000-000000000001/uploads/attachment.png",
    "compressUrl": "",
    "posterUrl": "",
    "userid": "10000000-0000-4000-8000-000000000001",
    "roteid": null,
    "storage": "R2",
    "details": {
      "key": "users/10000000-0000-4000-8000-000000000001/uploads/attachment.png",
      "size": 1024,
      "mimetype": "image/png",
      "mediaKind": "image",
      "mtime": "2026-07-23T00:00:00.000Z"
    },
    "createdAt": "2026-07-23T00:00:00.000Z",
    "updatedAt": "2026-07-23T00:00:00.000Z",
    "sortIndex": 0
  }
}
```

客户端应使用返回的 `data` 替换原远程附件，然后再调用 `/users/me/import`。推荐顺序为：

1. 调用 `/users/me/import/plan` 找出需要处理的笔记。
2. 对这些笔记中的每个远程附件调用本接口，并替换为返回的附件记录。
3. 将迁移后的笔记分批提交给 `/users/me/import`。

可能的错误包括：

- `401`：Rote 登录令牌无效。
- `403 remote_attachment_forbidden`：当前用户不允许上传附件。
- `413 remote_attachment_too_large`：远程附件超过大小限制。
- `422 remote_attachment_invalid` 或 `remote_attachment_unsupported`：请求或媒体类型无效。
- `429 remote_attachment_busy`：服务器迁移队列已满。
- `502 remote_attachment_download_failed`：无法下载远程附件。
- `503 remote_attachment_storage_unavailable`：对象存储不可用。

## 12. 执行用户数据导入

`POST /v2/api/users/me/import`

### 12.1 顶层请求结构

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

### 12.2 笔记、文章和附件结构

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
- `createdAt`、`updatedAt` 和 `source.sourceUpdatedAt` 使用 ISO 8601 日期时间字符串。笔记的 `createdAt`
  会保留；`updatedAt` 会被忽略并写为本次导入时间；`sourceUpdatedAt` 当前只参与格式校验，不会持久化或用于冲突判断。

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
附件的 `createdAt` 会保留，`updatedAt` 会被忽略并写为本次导入时间。`details` 必须是对象，并需符合对应
存储类型的附件校验规则。

来源标识结构：

```json
{
  "provider": "memos",
  "accountId": "account-1",
  "externalId": "memo-1",
  "sourceUpdatedAt": "2026-07-23T00:00:00.000Z"
}
```

同一请求中不能包含重复的笔记来源标识，也不能在同一笔记内包含重复的附件来源标识。附件来源映射只会在
父笔记也包含 `source` 时持久化并用于后续幂等导入；只有 `attachments[].source` 而没有 `note.source` 时，
重复执行 `overwrite` 导入可能创建新的附件记录。

### 12.3 请求与响应示例

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

## 13. 管理已屏蔽用户

屏蔽关系由 Server 按账户持久化，跨 Web、iOS、重装和多设备保持一致。

### 获取完整屏蔽列表

`GET /v2/api/users/me/blocks`

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "blocked-user",
      "nickname": "Blocked User",
      "avatar": null,
      "description": null,
      "certified": false,
      "blockedAt": "2026-07-28T08:00:00.000Z"
    }
  ]
}
```

列表按 `blockedAt` 降序、目标用户 ID 升序稳定排列。

### 屏蔽与解除

```bash
curl -X PUT \
  'https://your-domain.com/v2/api/users/me/blocks/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'

curl -X DELETE \
  'https://your-domain.com/v2/api/users/me/blocks/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

成功数据分别为：

```json
{ "blocked": true, "targetUserId": "550e8400-e29b-41d4-a716-446655440000" }
```

```json
{ "blocked": false, "targetUserId": "550e8400-e29b-41d4-a716-446655440000" }
```

重复调用是幂等的。不能屏蔽自己；屏蔽不存在的目标返回 `404`。解除不存在的关系仍成功返回
`blocked: false`。

登录用户的公开列表、搜索、随机、详情、batch、用户公开笔记和文章查询会在数据库分页前排除
双方任一方向存在屏蔽的作者；具名 reaction 也对相关 viewer 隐藏。双方不能新增 reaction。
RSS、sitemap 和真正匿名请求保持公开语义。

屏蔽不是内容隐私或访问控制保证：公开 Rote 和 Article 仍是公开资源，退出登录后 Server
无法把匿名请求与账户屏蔽关系绑定。客户端不得把屏蔽描述成“将公开内容设为私密”。

## 14. 删除当前用户账户

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
- 导入前先调用 `/me/import/plan`，通过 `/v2/api/imports/attachments/migrate` 迁移所需远程附件，再分批调用
  `/me/import`。
- 使用 `source` 标识外部数据；附件要获得稳定的重复导入身份，其父笔记也必须包含 `source`。
- 导出接口返回原始文件，其他接口返回统一响应对象，客户端解析时需区分。
- 删除账户不可恢复，应在客户端二次确认，并优先提示用户导出备份。
