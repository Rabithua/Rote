# Rote API 接口完整表

## 概述

本文档包含 Rote 系统的所有 API 接口，包括已实现的 v2 版本 RESTful 接口、搜索功能接口和兼容的 v1 接口。

## 基础信息

- **基础 URL**: `/v2/api`
- **响应格式**: JSON
- **认证方式**: Session 认证 / API 密钥认证

### 标准响应格式

```json
{
  "code": 0,         // 业务状态码，0表示成功
  "message": "...",  // 状态描述
  "data": { ... }    // 业务数据
}
```

## API 接口列表

### 1. 系统相关

| 接口路径        | HTTP 方法 | 认证要求 | 描述             | 版本 |
| --------------- | --------- | -------- | ---------------- | ---- |
| `/health`       | GET       | 无       | 健康检查         | v2   |
| `/site/sitemap` | GET       | 无       | 获取站点地图数据 | v2   |
| `/site/status`  | GET       | 无       | 获取站点状态     | v2   |

### 2. 认证相关

| 接口路径         | HTTP 方法 | 认证要求 | 描述     | 版本 |
| ---------------- | --------- | -------- | -------- | ---- |
| `/auth/register` | POST      | 无       | 用户注册 | v2   |
| `/auth/login`    | POST      | 无       | 用户登录 | v2   |
| `/auth/logout`   | POST      | 需要登录 | 用户登出 | v2   |
| `/auth/password` | PUT       | 需要登录 | 修改密码 | v2   |

### 3. 用户相关

| 接口路径               | HTTP 方法 | 认证要求 | 描述               | 版本 |
| ---------------------- | --------- | -------- | ------------------ | ---- |
| `/users/:username`     | GET       | 无       | 获取用户信息       | v2   |
| `/users/me/profile`    | GET       | 需要登录 | 获取当前用户资料   | v2   |
| `/users/me/profile`    | PUT       | 需要登录 | 更新当前用户资料   | v2   |
| `/users/me/sessions`   | GET       | 需要登录 | 获取当前用户会话   | v2   |
| `/users/me/tags`       | GET       | 需要登录 | 获取当前用户标签   | v2   |
| `/users/me/heatmap`    | GET       | 需要登录 | 获取用户热力图数据 | v2   |
| `/users/me/statistics` | GET       | 需要登录 | 获取用户统计信息   | v2   |
| `/users/me/export`     | GET       | 需要登录 | 导出用户数据       | v2   |
| `/users/:username/rss` | GET       | 无       | 获取用户 RSS 订阅  | v2   |

### 4. RSS 相关

| 接口路径               | HTTP 方法 | 认证要求 | 描述                 | 版本 |
| ---------------------- | --------- | -------- | -------------------- | ---- |
| `/users/:username/rss` | GET       | 无       | 获取用户 RSS 订阅    | v2   |
| `/rss/public`          | GET       | 无       | 获取所有公开笔记 RSS | v2   |

#### RSS 功能说明

- **用户 RSS**: 获取指定用户的所有公开笔记 RSS 订阅
- **公开 RSS**: 获取全站所有用户的公开笔记 RSS 订阅
- **输出格式**: RSS 2.0 标准格式
- **Content-Type**: `application/xml`
- **自动更新**: RSS 内容会根据笔记的创建和更新时间自动刷新

### 5. 笔记相关

| 接口路径                 | HTTP 方法 | 认证要求 | 描述                   | 版本 |
| ------------------------ | --------- | -------- | ---------------------- | ---- |
| `/notes`                 | POST      | 需要登录 | 创建笔记               | v2   |
| `/notes`                 | GET       | 需要登录 | 获取当前用户的笔记列表 | v2   |
| `/notes/:id`             | GET       | 动态     | 获取笔记详情           | v2   |
| `/notes/:id`             | PUT       | 需要登录 | 更新笔记               | v2   |
| `/notes/:id`             | DELETE    | 需要登录 | 删除笔记               | v2   |
| `/notes/random`          | GET       | 无       | 获取随机笔记           | v2   |
| `/notes/public`          | GET       | 无       | 获取所有公开笔记       | v2   |
| `/notes/users/:username` | GET       | 无       | 获取用户公开笔记       | v2   |

#### 笔记查询参数

- `skip`: 跳过的笔记数量（分页）
- `limit`: 返回的笔记数量限制（默认 20）
- `archived`: 是否包含已归档笔记 (true/false)
- `tag`: 标签过滤（支持多个标签）

### 6. 搜索相关 🆕

| 接口路径                        | HTTP 方法 | 认证要求 | 描述                   | 版本 |
| ------------------------------- | --------- | -------- | ---------------------- | ---- |
| `/notes/search`                 | GET       | 需要登录 | 搜索当前用户的笔记     | v2   |
| `/notes/search/public`          | GET       | 无       | 搜索公开笔记           | v2   |
| `/notes/search/users/:username` | GET       | 无       | 搜索指定用户的公开笔记 | v2   |

#### 搜索参数

- `keyword` (必需): 搜索关键词
- `skip`: 跳过的笔记数量（分页）
- `limit`: 返回的笔记数量限制（默认 20）
- `archived`: 是否搜索已归档的笔记 (true/false)
- `tag`: 按标签过滤（支持多个标签）

#### 搜索特性

- **多字段搜索**: 同时搜索标题、内容和标签
- **不区分大小写**: 标题和内容搜索不区分大小写
- **标签精确匹配**: 标签搜索采用精确匹配
- **OR 逻辑**: 关键词在任一字段匹配即返回

### 7. 反应系统相关 🆕

| 接口路径                   | HTTP 方法 | 认证要求 | 描述     | 版本 |
| -------------------------- | --------- | -------- | -------- | ---- |
| `/reactions`               | POST      | 无       | 添加反应 | v2   |
| `/reactions/:roteid/:type` | DELETE    | 无       | 删除反应 | v2   |

#### 反应系统功能说明

- **支持用户类型**: 已登录用户和匿名访客
- **反应类型**: 支持任意 emoji 表情反应（如：👍、❤️、😊 等）
- **多重反应**: 同一用户可以对同一笔记添加多种不同类型的反应
- **访客识别**: 使用设备指纹技术识别匿名访客
- **实时更新**: 反应数据会实时更新到笔记详情中

#### 添加反应

```bash
POST /api/v2/reactions
Content-Type: application/json

# 已登录用户添加反应
{
  "type": "👍",
  "roteid": "507f1f77bcf86cd799439011",
  "metadata": {
    "source": "web"
  }
}

# 匿名访客添加反应
{
  "type": "❤️",
  "roteid": "507f1f77bcf86cd799439011",
  "visitorId": "fp_1234567890abcdef",
  "visitorInfo": {
    "browser": "Chrome",
    "os": "macOS"
  },
  "metadata": {
    "source": "web"
  }
}
```

#### 删除反应

```bash
# 已登录用户删除反应
DELETE /api/v2/reactions/507f1f77bcf86cd799439011/👍

# 匿名访客删除反应（需要visitorId参数）
DELETE /api/v2/reactions/507f1f77bcf86cd799439011/❤️?visitorId=fp_1234567890abcdef
```

#### 参数说明

- `type`: 反应类型，支持任意 emoji 字符
- `roteid`: 笔记 ID（24 位 MongoDB ObjectId）
- `visitorId`: 访客设备指纹 ID（匿名用户必需）
- `visitorInfo`: 访客信息（可选，用于统计分析）
- `metadata`: 附加元数据（可选）

### 8. 通知相关

| 接口路径         | HTTP 方法 | 认证要求 | 描述     | 版本 |
| ---------------- | --------- | -------- | -------- | ---- |
| `/notifications` | POST      | 需要登录 | 创建通知 | v2   |

### 9. 订阅相关

| 接口路径                    | HTTP 方法 | 认证要求 | 描述         | 版本 |
| --------------------------- | --------- | -------- | ------------ | ---- |
| `/subscriptions`            | POST      | 需要登录 | 添加订阅     | v2   |
| `/subscriptions`            | GET       | 需要登录 | 获取用户订阅 | v2   |
| `/subscriptions/test-all`   | POST      | 需要登录 | 测试所有端点 | v2   |
| `/subscriptions/:id`        | PUT       | 需要登录 | 更新订阅     | v2   |
| `/subscriptions/:id`        | DELETE    | 需要登录 | 删除订阅     | v2   |
| `/subscriptions/:id/notify` | POST      | 无       | 发送通知     | v2   |

### 10. API 密钥相关

| 接口路径        | HTTP 方法 | 认证要求 | 描述              | 版本 |
| --------------- | --------- | -------- | ----------------- | ---- |
| `/api-keys`     | POST      | 需要登录 | 生成 API 密钥     | v2   |
| `/api-keys`     | GET       | 需要登录 | 获取所有 API 密钥 | v2   |
| `/api-keys/:id` | PUT       | 需要登录 | 更新 API 密钥     | v2   |
| `/api-keys/:id` | DELETE    | 需要登录 | 删除 API 密钥     | v2   |

### 11. 附件相关

| 接口路径                | HTTP 方法 | 认证要求 | 描述                          | 版本 |
| ----------------------- | --------- | -------- | ----------------------------- | ---- |
| `/attachments`          | POST      | 需要登录 | 服务器中转上传（兼容保留）    | v2   |
| `/attachments`          | DELETE    | 需要登录 | 批量删除附件                  | v2   |
| `/attachments/:id`      | DELETE    | 需要登录 | 删除单个附件                  | v2   |
| `/attachments/presign`  | POST      | 需要登录 | 前端直传：获取 PUT 预签名链接 | v2   |
| `/attachments/finalize` | POST      | 需要登录 | 前端直传完成回调并写入数据库  | v2   |

#### 前端直传流程

1. 请求预签名链接

```bash
POST /api/v2/attachments/presign
Content-Type: application/json

{
  "files": [
    { "filename": "IMG_001.jpg", "contentType": "image/jpeg", "size": 1234567 },
    { "filename": "shot.png", "contentType": "image/png", "size": 345678 }
  ]
}

# 响应（节选）
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "uuid": "<uuid>",
        "original": { "key": "users/<uid>/uploads/<uuid>.jpg", "putUrl": "...", "url": "..." },
        "compressed": { "key": "users/<uid>/compressed/<uuid>.webp", "putUrl": "...", "url": "..." }
      }
    ]
  }
}
```

2. 前端分别 PUT 上传原图与压缩图（压缩图由浏览器端生成 webp），完成后调用 finalize：

```bash
POST /api/v2/attachments/finalize
Content-Type: application/json

{
  "noteId": "<可选-绑定笔记ID>",
  "attachments": [
    {
      "uuid": "<uuid>",
      "originalKey": "users/<uid>/uploads/<uuid>.jpg",
      "compressedKey": "users/<uid>/compressed/<uuid>.webp",
      "size": 1234567,
      "mimetype": "image/jpeg",
      "hash": "<可选-SHA256>"
    }
  ]
}

# 响应（节选）
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "<attachment-id>",
      "url": "https://<R2_URL_PREFIX>/users/<uid>/uploads/<uuid>.jpg",
      "compressUrl": "https://<R2_URL_PREFIX>/users/<uid>/compressed/<uuid>.webp",
      "details": {
        "key": "users/<uid>/uploads/<uuid>.jpg",
        "compressKey": "users/<uid>/compressed/<uuid>.webp",
        "size": 1234567,
        "mimetype": "image/jpeg"
      }
    }
  ]
}
```

说明：

- 预签名默认有效期约 15 分钟；仅允许当前用户命名空间（users/<uid>/）下的对象。
- finalize 为幂等：若同一 originalKey 已存在，将更新压缩信息与元数据；否则创建新记录。
- 仍保留 `/attachments` 作为服务器中转上传的兼容接口，推荐前端直传优先。

### 12. OpenKey API（API 密钥访问）

| 接口路径                | HTTP 方法 | 认证要求 | 描述                 | 版本 |
| ----------------------- | --------- | -------- | -------------------- | ---- |
| `/openkey/notes/create` | GET       | API 密钥 | 创建笔记（兼容接口） | v2   |
| `/openkey/notes`        | POST      | API 密钥 | 创建笔记             | v2   |
| `/openkey/notes`        | GET       | API 密钥 | 获取笔记列表         | v2   |
| `/openkey/notes/search` | GET       | API 密钥 | 搜索笔记 🆕          | v2   |

#### OpenKey 认证

在请求头中包含 API 密钥：

```
Authorization: Bearer YOUR_API_KEY
```

## 兼容性说明

### v1 接口（已废弃）

为保持向后兼容，v1 接口仍然可用，但建议迁移到 v2 接口：

- **v1 基础 URL**: `/api/v1`
- **废弃计划**: 计划在未来版本中移除
- **迁移指南**: 参考 [API-RESTRUCTURING.md](./API-RESTRUCTURING.md)

### 主要差异

1. **URL 风格**: v2 使用 kebab-case，v1 使用 camelCase
2. **HTTP 方法**: v2 严格遵循 RESTful 约定
3. **响应格式**: v2 使用统一的响应格式
4. **错误处理**: v2 提供更详细的错误信息

## 使用示例

### 搜索笔记

```bash
# 搜索我的笔记
GET /api/v2/notes/search?keyword=JavaScript&limit=10

# 搜索公开笔记
GET /api/v2/notes/search/public?keyword=React&tag=教程

# 搜索特定用户的笔记
GET /api/v2/notes/search/users/john?keyword=API
```

### 创建笔记

```bash
POST /api/v2/notes
Content-Type: application/json

{
  "title": "新笔记",
  "content": "笔记内容",
  "tags": ["标签1", "标签2"],
  "state": "public"
}
```

### 使用 API 密钥

```bash
GET /api/v2/openkey/notes/search?keyword=test
Authorization: Bearer your-api-key-here
```

### 反应系统

```bash
# 添加反应（已登录用户）
POST /api/v2/reactions
Content-Type: application/json

{
  "type": "👍",
  "roteid": "507f1f77bcf86cd799439011"
}

# 添加反应（匿名访客）
POST /api/v2/reactions
Content-Type: application/json

{
  "type": "❤️",
  "roteid": "507f1f77bcf86cd799439011",
  "visitorId": "fp_1234567890abcdef",
  "visitorInfo": {
    "browser": "Chrome",
    "os": "macOS"
  }
}

# 删除反应（已登录用户）
DELETE /api/v2/reactions/507f1f77bcf86cd799439011/👍

# 删除反应（匿名访客）
DELETE /api/v2/reactions/507f1f77bcf86cd799439011/❤️?visitorId=fp_1234567890abcdef
```

### RSS 订阅

```bash
# 获取用户RSS订阅
GET /api/v2/users/john/rss

# 获取所有公开笔记RSS
GET /api/v2/rss/public
```

## 错误响应

### 常见错误码

| HTTP 状态码 | 业务状态码 | 描述            |
| ----------- | ---------- | --------------- |
| 200         | 0          | 成功            |
| 400         | 400        | 请求参数错误    |
| 401         | 401        | 未授权/需要登录 |
| 403         | 403        | 权限不足        |
| 404         | 404        | 资源不存在      |
| 500         | 500        | 服务器内部错误  |

### 错误响应示例

```json
{
  "code": 400,
  "message": "Keyword is required",
  "data": null
}
```

## 性能建议

1. **分页**: 使用 `skip` 和 `limit` 参数进行分页
2. **缓存**: 合理使用客户端缓存
3. **限流**: API 具有速率限制保护
4. **批量操作**: 优先使用批量删除等批量接口

## 更新日志

### v2.3.0 (最新)

- ✅ 新增反应系统功能
- ✅ 支持已登录用户和匿名访客反应 (`/reactions`)
- ✅ 支持任意 emoji 表情反应
- ✅ 支持多重反应（同一用户可添加多种反应）
- ✅ 设备指纹技术识别匿名访客
- ✅ 反应数据实时更新到笔记详情

### v2.2.0

- ✅ 新增 RSS 订阅功能
- ✅ 支持用户 RSS 订阅 (`/users/:username/rss`)
- ✅ 支持全站公开笔记 RSS (`/rss/public`)
- ✅ RSS 2.0 标准格式输出

### v2.1.0

- ✅ 新增搜索功能接口
- ✅ 支持关键词搜索笔记标题、内容和标签
- ✅ 支持 API 密钥搜索
- ✅ 优化响应格式和错误处理

### v2.0.0

- ✅ 完整的 RESTful API 重构
- ✅ 统一响应格式
- ✅ 改进的错误处理
- ✅ API 密钥认证支持

---

_最后更新: 2025-06-08_
