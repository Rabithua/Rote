# Rote API 接口速览（v2）

本文档为精简版，仅保留 v2 接口与必要说明；所有 v1/兼容与冗长示例已移除。

## 基础信息

- 基础 URL: `/v2/api`
- 响应格式: JSON
- 认证方式: 会话/JWT/API Key（按接口要求）

### 标准响应

```json
{ "code": 0, "message": "success", "data": null }
```

## 接口一览

### 1) 系统

| 路径      | 方法 | 认证 | 描述     |
| --------- | ---- | ---- | -------- |
| `/health` | GET  | 无   | 健康检查 |

### 2) 认证

| 路径                               | 方法     | 认证 | 描述                                         |
| ---------------------------------- | -------- | ---- | -------------------------------------------- |
| `/auth/register`                   | POST     | 无   | 用户注册                                     |
| `/auth/login`                      | POST     | 无   | 用户登录                                     |
| `/auth/password`                   | PUT      | 登录 | 修改密码（仅本地账户）                       |
| `/auth/refresh`                    | POST     | 无   | 刷新 Token                                   |
| `/auth/oauth/:provider`            | GET      | 无   | 发起 OAuth 授权（动态路由，支持多个提供商）  |
| `/auth/oauth/:provider/callback`   | GET/POST | 无   | OAuth 回调处理（根据提供商决定 GET 或 POST） |
| `/auth/oauth/:provider/bind`       | GET      | 登录 | 绑定 OAuth 账户到现有账户                    |
| `/auth/oauth/:provider/bind`       | DELETE   | 登录 | 解绑 OAuth 账户                              |
| `/auth/oauth/:provider/bind/merge` | POST     | 登录 | 确认合并账户并绑定 OAuth                     |

### 3) 用户

| 路径                   | 方法   | 认证 | 描述         |
| ---------------------- | ------ | ---- | ------------ |
| `/users/:username`     | GET    | 无   | 获取用户信息 |
| `/users/me/profile`    | GET    | 登录 | 获取我的资料 |
| `/users/me/profile`    | PUT    | 登录 | 更新我的资料 |
| `/users/me/tags`       | GET    | 登录 | 获取我的标签 |
| `/users/me/heatmap`    | GET    | 登录 | 活跃热力图   |
| `/users/me/statistics` | GET    | 登录 | 统计信息     |
| `/users/me/export`     | GET    | 登录 | 导出数据     |
| `/users/me`            | DELETE | 登录 | 删除账户     |

### 4) RSS

| 路径             | 方法 | 认证 | 描述             |
| ---------------- | ---- | ---- | ---------------- |
| `/rss/:username` | GET  | 无   | 用户公开笔记 RSS |
| `/rss/public`    | GET  | 无   | 全站公开笔记 RSS |

### 5) 笔记

| 路径                     | 方法   | 认证 | 描述                              |
| ------------------------ | ------ | ---- | --------------------------------- |
| `/notes`                 | POST   | 登录 | 创建笔记                          |
| `/notes`                 | GET    | 登录 | 我的笔记列表                      |
| `/notes/:id`             | GET    | 动态 | 笔记详情（公开/私有由服务端控制） |
| `/notes/:id`             | PUT    | 登录 | 更新笔记                          |
| `/notes/:id`             | DELETE | 登录 | 删除笔记                          |
| `/notes/random`          | GET    | 无   | 随机笔记                          |
| `/notes/public`          | GET    | 无   | 所有公开笔记                      |
| `/notes/users/:username` | GET    | 无   | 指定用户公开笔记                  |

查询参数（通用）：`skip`, `limit`, `archived`, `tag`

### 6) 搜索

| 路径                            | 方法 | 认证 | 描述                 |
| ------------------------------- | ---- | ---- | -------------------- |
| `/notes/search`                 | GET  | 登录 | 搜索我的笔记         |
| `/notes/search/public`          | GET  | 无   | 搜索公开笔记         |
| `/notes/search/users/:username` | GET  | 无   | 搜索指定用户公开笔记 |

参数：`keyword`（必填），可选 `skip/limit/archived/tag`

### 7) 反应（Reactions）

| 路径                       | 方法   | 认证 | 描述                           |
| -------------------------- | ------ | ---- | ------------------------------ |
| `/reactions`               | POST   | 无   | 添加反应（支持登录/匿名）      |
| `/reactions/:roteid/:type` | DELETE | 无   | 删除反应（匿名需 `visitorId`） |

字段：`type`(emoji), `roteid`, `visitorId?`, `visitorInfo?`, `metadata?`

### 8) 通知

| 路径             | 方法 | 认证 | 描述     |
| ---------------- | ---- | ---- | -------- |
| `/notifications` | POST | 登录 | 创建通知 |

### 9) 订阅

| 路径                        | 方法   | 认证 | 描述         |
| --------------------------- | ------ | ---- | ------------ |
| `/subscriptions`            | POST   | 登录 | 添加订阅     |
| `/subscriptions`            | GET    | 登录 | 获取我的订阅 |
| `/subscriptions/test-all`   | POST   | 登录 | 测试所有端点 |
| `/subscriptions/:id`        | PUT    | 登录 | 更新订阅     |
| `/subscriptions/:id`        | DELETE | 登录 | 删除订阅     |
| `/subscriptions/:id/notify` | POST   | 无   | 触发通知     |

### 10) API Keys

| 路径            | 方法   | 认证 | 描述         |
| --------------- | ------ | ---- | ------------ |
| `/api-keys`     | POST   | 登录 | 生成 API Key |
| `/api-keys`     | GET    | 登录 | 列出 API Key |
| `/api-keys/:id` | PUT    | 登录 | 更新 API Key |
| `/api-keys/:id` | DELETE | 登录 | 删除 API Key |

### 11) 附件

| 路径                    | 方法   | 认证 | 描述                   |
| ----------------------- | ------ | ---- | ---------------------- |
| `/attachments`          | POST   | 登录 | 服务器中转上传（兼容） |
| `/attachments`          | DELETE | 登录 | 批量删除               |
| `/attachments/:id`      | DELETE | 登录 | 删除单个               |
| `/attachments/presign`  | POST   | 登录 | 获取直传预签名链接     |
| `/attachments/finalize` | POST   | 登录 | 直传完成回调入库       |
| `/attachments/sort`     | PUT    | 登录 | 更新附件排序           |

直传要点：仅允许 `users/<uid>/...` 命名空间；`finalize` 幂等；优先使用直传。

### 12) 变更记录（Change Log）

| 路径                        | 方法 | 认证 | 描述               |
| --------------------------- | ---- | ---- | ------------------ |
| `/changes/origin/:originid` | GET  | 登录 | 按原始笔记 ID 查询 |
| `/changes/rote/:roteid`     | GET  | 登录 | 按当前笔记 ID 查询 |
| `/changes/user`             | GET  | 登录 | 我的全部变更       |
| `/changes/after`            | GET  | 登录 | 指定时间之后的变更 |

字段：`originid`, `roteid?`, `action`(CREATE/UPDATE/DELETE), `userid`, `createdAt`

### 13) OpenKey（API Key 访问）

| 路径                    | 方法 | 认证    | 描述             |
| ----------------------- | ---- | ------- | ---------------- |
| `/openkey/notes/create` | GET  | API Key | 创建笔记（兼容） |
| `/openkey/notes`        | POST | API Key | 创建笔记         |
| `/openkey/notes`        | GET  | API Key | 获取笔记列表     |
| `/openkey/notes/search` | GET  | API Key | 搜索笔记         |

请求头：`Authorization: Bearer <API_KEY>`

### 14) 站点

| 路径                  | 方法 | 认证 | 描述                 |
| --------------------- | ---- | ---- | -------------------- |
| `/site/sitemap`       | GET  | 无   | 标准 XML Sitemap     |
| `/site/status`        | GET  | 无   | 站点状态             |
| `/site/config-status` | GET  | 无   | 系统配置状态（引导） |

### 15) 管理端（Admin）

| 路径                                | 方法   | 认证             | 描述                       |
| ----------------------------------- | ------ | ---------------- | -------------------------- |
| `/admin/status`                     | GET    | 无               | 初始化状态与检查项         |
| `/admin/setup`                      | POST   | 无               | 初始化（安装向导）         |
| `/admin/settings`                   | GET    | 管理员           | 获取配置（可分组）         |
| `/admin/settings`                   | PUT    | 管理员           | 更新配置（系统配置需超管） |
| `/admin/settings/test`              | POST   | 初始化后需管理员 | 测试配置连接               |
| `/admin/settings/regenerate-keys`   | POST   | 超级管理员       | 重生成安全密钥             |
| `/admin/settings/detect-urls`       | GET    | 管理员           | 自动检测 API/前端 URL      |
| `/admin/settings/update-urls`       | POST   | 管理员           | 更新站点 URL 配置          |
| `/admin/refresh-cache`              | POST   | 无               | 刷新配置缓存（测试）       |
| `/admin/users`                      | GET    | 管理员           | 用户列表（分页/筛选/搜索） |
| `/admin/users/:userId`              | GET    | 管理员           | 用户详情                   |
| `/admin/users/:userId/role`         | PUT    | 超级管理员       | 更新用户角色               |
| `/admin/users/:userId/verify-email` | PUT    | 管理员           | 验证用户邮箱               |
| `/admin/users/:userId`              | DELETE | 超级管理员       | 删除用户                   |
| `/admin/roles/stats`                | GET    | 管理员           | 角色统计                   |

> 通过 `Authorization: Bearer <accessToken>` 鉴权，并基于 `role` 判定权限。

## 请求体结构参考（精简）

以下为常用可写接口的请求体示例（字段后缀 `?` 表示可选）。

### 认证

```json
// POST /v2/api/auth/register
{ "username": "john", "email": "john@example.com", "password": "P@ssw0rd" }

// POST /v2/api/auth/login
{ "username": "john", "password": "P@ssw0rd" }

// PUT /v2/api/auth/password
{ "oldpassword": "old", "newpassword": "newStrongPass" }
```

**注意**：

- OAuth 用户（通过第三方登录）不能使用密码登录，也不能修改密码
- OAuth 登录流程：访问 `/auth/oauth/:provider` 发起授权（`:provider` 为提供商名称，如 `github`、`apple`），完成后重定向到回调地址
- 支持的提供商：GitHub、Apple 等（可通过配置启用）
- 账户绑定：已登录的用户可以将 OAuth 账户绑定到现有账户，实现多种登录方式
- 账户合并：如果 OAuth 账户已被其他用户使用，可以合并账户，将源账户的数据迁移到目标账户
- 解绑限制：如果用户没有设置密码且是纯 OAuth 用户，则不允许解绑，避免账户被锁定

### 笔记

```json
// POST /v2/api/notes
{ "title": "新笔记", "content": "内容", "tags": ["tag1"], "state": "public" }

// PUT /v2/api/notes/:id
{ "title?": "更新标题", "content?": "更新内容", "tags?": ["tag1"], "state?": "private", "archived?": false }
```

### 反应（Reactions）

```json
// POST /v2/api/reactions
{
  "type": "👍",
  "roteid": "<note-id>",
  "visitorId?": "fp_xxx",
  "visitorInfo?": { "browser": "Chrome" },
  "metadata?": { "source": "web" }
}
```

### 通知

```json
// POST /v2/api/notifications
{
  "title": "更新通知",
  "body": "你有一条新消息",
  "target": { "type": "user", "id": "<user-id>" }
}
```

### 订阅

```json
// POST /v2/api/subscriptions
{ "endpoint": "https://push.example", "keys": { "p256dh": "...", "auth": "..." }, "platform?": "web" }

// PUT /v2/api/subscriptions/:id
{ "enabled?": true, "label?": "我的订阅" }
```

**订阅说明**：

- 一个用户可以有多个订阅（不同设备/浏览器）
- 每个 `endpoint` 只能有一个订阅（唯一约束）
- 当 `endpoint` 已存在时，会自动更新现有订阅而不是创建新订阅
- 错误响应：
  - `409`: `"Subscription endpoint already exists"` - endpoint 已存在
  - `409`: `"Username or email already exists"` - 用户相关唯一约束错误

### API Keys

```json
// POST /v2/api/api-keys
{ "label": "iOS 客户端", "scopes?": ["notes:read", "notes:write"] }

// PUT /v2/api/api-keys/:id
{ "label?": "重命名", "scopes?": ["notes:read"] , "enabled?": true }
```

### 附件直传

```json
// POST /v2/api/attachments/presign
{ "files": [ { "filename": "a.jpg", "contentType": "image/jpeg", "size": 12345 } ] }

// POST /v2/api/attachments/finalize
{ "noteId?": "<note-id>", "attachments": [ { "uuid": "<uuid>", "originalKey": "users/<uid>/uploads/<uuid>.jpg", "compressedKey?": "users/<uid>/compressed/<uuid>.webp", "size": 12345, "mimetype": "image/jpeg", "hash?": "sha256" } ] }

// PUT /v2/api/attachments/sort
{ "roteId": "<note-id>", "attachmentIds": ["att-1", "att-2"] }
```

### OpenKey（API Key）

```json
// POST /v2/api/openkey/notes
{
  "title": "来自 API Key",
  "content": "...",
  "tags?": ["api"],
  "state?": "public"
}
```

### 管理端设置

```json
// PUT /v2/api/admin/settings
{ "group": "site", "values": { "siteUrl": "https://example.com", "apiUrl": "https://api.example.com" } }

// POST /v2/api/admin/settings/test
{ "targets": ["database", "r2", "webpush"] }

// POST /v2/api/admin/settings/update-urls
{ "siteUrl": "https://example.com", "apiUrl": "https://api.example.com" }
```

## 错误码（精简）

| HTTP | 业务码 | 描述            |
| ---- | ------ | --------------- |
| 200  | 0      | 成功            |
| 400  | 400    | 请求参数错误    |
| 401  | 401    | 未授权/需要登录 |
| 403  | 403    | 权限不足        |
| 404  | 404    | 资源不存在      |
| 500  | 500    | 服务器内部错误  |

---

最后更新：2025-12-02
