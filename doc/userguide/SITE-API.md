## 站点接口使用指南

本指南面向对接方，说明如何使用站点相关的接口进行站点信息查询、状态检查、配置状态获取等操作。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api/site`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 站点相关接口无需认证，均为公开接口

---

### 1) 获取站点地图数据（XML Sitemap）

- **方法**: GET
- **URL**: `/v2/api/site/sitemap`
- **Headers**: 无需认证（返回 `Content-Type: application/xml`）

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/site/sitemap' \
  -H 'Accept: application/xml'
```

成功响应示例（200）：

```
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://rote.ink/landing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://rote.ink/demo</loc>
    <lastmod>2024-01-01T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://rote.ink/rote/3fb32cfa-...</loc>
    <lastmod>2024-01-10T12:00:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>
```

说明：

- 以标准 XML Sitemap 协议返回数据，可直接被搜索引擎抓取
- 包含站点内常见的公开页面（如 `/landing`、`/explore` 等）
- 自动列出所有用户主页 URL：`/:username`
- 自动列出所有公开、未归档的笔记 URL：`/rote/:roteid`
- 每条记录包含 `loc`（页面地址），可选的 `lastmod`（更新时间）、`changefreq` 与 `priority`

可能的错误：

- 500 服务器内部错误（生成 sitemap 失败时返回 JSON 错误响应）

---

### 2) 获取站点状态和基本信息

- **方法**: GET
- **URL**: `/v2/api/site/status`
- **Headers**: 无需认证

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/site/status'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "isInitialized": true,
    "databaseConnected": true,
    "site": {
      "name": "Rote",
      "description": "一个开源的个人笔记仓库系统",
      "frontendUrl": "https://rote.ink",
      "defaultLanguage": "zh-CN"
    },
    "system": {
      "version": "1.0.0",
      "lastMigration": "1.0.0"
    },
    "notification": {
      "vapidPublicKey": "BEl62iUYgUivxIkv69yViEuiBIa40HI..."
    },
    "storage": {
      "r2Configured": true,
      "urlPrefix": "https://cdn.rote.ink"
    },
    "ui": {
      "allowRegistration": true,
      "allowUploadFile": true
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

字段说明：

- `isInitialized`: boolean - 系统是否已初始化
- `databaseConnected`: boolean - 数据库连接状态
- `site`: object - 站点基本信息
  - `name`: string - 站点名称
  - `description`: string - 站点描述
  - `frontendUrl`: string - 前端地址
  - `defaultLanguage`: string - 默认语言
- `system`: object - 系统信息
  - `version`: string - 系统版本
  - `lastMigration`: string - 最后迁移版本
- `notification`: object - 通知配置
  - `vapidPublicKey`: string | null - VAPID 公钥（用于 Web Push 通知）
- `storage`: object - 存储配置
  - `r2Configured`: boolean - R2 存储是否已配置
  - `urlPrefix`: string - 存储 URL 前缀（如果 R2 已配置）
- `ui`: object - UI 配置（仅包含与前端行为相关的开关）
  - `allowRegistration`: boolean - 是否允许注册
  - `allowUploadFile`: boolean - 是否允许上传文件
- `timestamp`: string - 响应时间戳（ISO 8601 格式）

说明：

- 此接口用于获取站点的完整状态信息，包括系统状态、配置信息等
- 前端可以根据返回的信息判断功能是否可用（如附件上传、用户注册等）
- `vapidPublicKey` 用于前端实现 Web Push 通知功能

可能的错误：

- 500 服务器内部错误

---

### 3) 获取系统配置状态

- **方法**: GET
- **URL**: `/v2/api/site/config-status`
- **Headers**: 无需认证

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/site/config-status'
```

成功响应示例（200）- 已初始化：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "isInitialized": true,
    "site": {
      "name": "Rote",
      "description": "一个开源的个人笔记仓库系统",
      "frontendUrl": "https://rote.ink"
    },
    "system": {
      "version": "1.0.0"
    }
  }
}
```

成功响应示例（200）- 未初始化：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "isInitialized": false,
    "requiresSetup": true,
    "setupSteps": ["basic", "database", "storage", "email", "security"]
  }
}
```

字段说明：

- `isInitialized`: boolean - 系统是否已初始化
- `site`: object（仅当已初始化时返回）- 站点基本信息
  - `name`: string - 站点名称
  - `description`: string - 站点描述
  - `frontendUrl`: string - 前端地址
- `system`: object（仅当已初始化时返回）- 系统信息
  - `version`: string - 系统版本
- `requiresSetup`: boolean（仅当未初始化时返回）- 是否需要设置
- `setupSteps`: string[]（仅当未初始化时返回）- 需要完成的设置步骤列表

说明：

- 此接口主要用于初始化向导，判断系统是否需要初始化
- 如果系统已初始化，返回基本的站点和系统信息
- 如果系统未初始化，返回初始化所需的信息和步骤列表
- 前端可以根据此接口的返回结果决定是否显示初始化向导

可能的错误：

- 500 服务器内部错误

---

### 客户端使用建议

- **无需认证**: 所有站点相关接口均为公开接口，无需认证即可访问
- **状态检查**: 建议在应用启动时调用 `/status` 接口检查系统状态和功能可用性
- **初始化判断**: 使用 `/config-status` 接口判断系统是否需要初始化，并引导用户完成初始化流程
- **站点地图**: `/sitemap` 接口返回的用户列表可用于生成站点地图，提升 SEO 效果
- **功能开关**: 根据 `/status` 接口返回的 `ui` 配置，在前端控制注册、文件上传等功能的显示和可用性
- **存储配置**: 通过 `storage.r2Configured` 判断附件上传功能是否可用，通过 `storage.urlPrefix` 获取附件访问地址前缀
- **Web Push**: 使用 `notification.vapidPublicKey` 实现 Web Push 通知功能

---

### 探索页可见性与邮箱验证策略说明

探索页中公开笔记的展示，除了依赖笔记本身为 `public` 状态外，还受到以下两个配置的共同影响：

- **用户级配置**（通过用户设置接口维护，见 `USER-API.md`）

  - `allowExplore`: boolean
    - 当为 `false` 时，用户的公开笔记不会出现在「探索」页推荐中，但仍可以通过直接链接访问。

- **系统级安全配置**（仅管理员可在管理后台 / Admin API 中配置）
  - `security.requireVerifiedEmailForExplore`: boolean
    - 当为 `true` 时，只有**邮箱已验证** (`emailVerified = true`) 且 `allowExplore !== false` 的用户，其公开笔记才会被纳入探索页候选集合。
    - 当为 `false` 时，只要 `allowExplore !== false`，公开笔记即可参与探索页展示。

实现层面，探索页相关接口在数据库查询阶段就会同时考虑上述两个条件进行过滤，从而保证：

- 分页结果中不会因为后置过滤出现「每页条数不稳定」或「空洞」的问题；
- 前端无需额外在客户端进行二次过滤，只需按 API 返回结果渲染即可。
