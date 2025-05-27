# REST API 重构文档

## 重构背景

原有API接口存在以下问题：

1. 不一致的URL命名风格（混用驼峰、下划线和短横线）
2. HTTP方法使用不规范（使用POST来获取资源）
3. 资源命名不符合RESTful规范
4. 响应格式不统一
5. 接口路径结构不清晰

## 重构原则

### 1. 统一命名约定

- 使用全小写单词，多个单词以短横线（kebab-case）分隔
- 资源名称使用复数形式

### 2. 统一HTTP方法使用

- GET：获取资源
- POST：创建资源
- PUT：更新资源（完整替换）
- PATCH：部分更新资源
- DELETE：删除资源

### 3. 资源结构化组织

采用嵌套结构表达资源之间的关系，如：

- `/users/{userId}/notes`：获取特定用户的所有笔记
- `/notes/{noteId}/attachments`：获取特定笔记的所有附件

### 4. 统一响应格式

```typescript
{
  "code": 0,         // 业务状态码，0表示成功
  "message": "...",  // 状态描述
  "data": { ... }    // 业务数据
}
```

### 5. 合理使用HTTP状态码

- 200: 成功
- 201: 创建成功
- 400: 请求错误
- 401: 未授权
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器错误

## 新旧API对照表

| 原API                      | 新API                       | HTTP方法 | 描述                   |
| -------------------------- | --------------------------- | -------- | ---------------------- |
| `/ping`                    | `/health`                   | GET      | 健康检查               |
| `/register`                | `/auth/register`            | POST     | 用户注册               |
| `/login/password`          | `/auth/login`               | POST     | 用户登录               |
| `/logout`                  | `/auth/logout`              | POST     | 用户登出               |
| `/change/password`         | `/auth/password`            | PUT      | 修改密码               |
| `/profile` (GET)           | `/users/me/profile`         | GET      | 获取当前用户资料       |
| `/profile` (POST)          | `/users/me/profile`         | PUT      | 更新当前用户资料       |
| `/getUserInfo`             | `/users/:username`          | GET      | 获取用户信息           |
| `/getMySession`            | `/users/me/sessions`        | GET      | 获取当前用户会话       |
| `/getMyTags`               | `/users/me/tags`            | GET      | 获取当前用户标签       |
| `/getMyHeatmap`            | `/users/me/heatmap`         | GET      | 获取用户热力图数据     |
| `/statistics`              | `/users/me/statistics`      | GET      | 获取用户统计信息       |
| `/exportData`              | `/users/me/export`          | GET      | 导出用户数据           |
| `/addRote`                 | `/notes`                    | POST     | 创建笔记               |
| `/oneRote` (GET)           | `/notes/:id`                | GET      | 获取笔记详情           |
| `/oneRote` (POST)          | `/notes/:id`                | PUT      | 更新笔记               |
| `/oneRote` (DELETE)        | `/notes/:id`                | DELETE   | 删除笔记               |
| `/getMyRote`               | `/notes`                    | GET      | 获取当前用户的笔记列表 |
| `/getUserPublicRote`       | `/notes/users/:username`    | GET      | 获取用户公开笔记       |
| `/getPublicRote`           | `/notes/public`             | GET      | 获取所有公开笔记       |
| `/randomRote`              | `/notes/random`             | GET      | 获取随机笔记           |
| `/notice`                  | `/notifications`            | POST     | 创建通知               |
| `/addSwSubScription`       | `/subscriptions`            | POST     | 添加订阅               |
| `/swSubScription` (GET)    | `/subscriptions`            | GET      | 获取用户订阅           |
| `/swSubScription` (DELETE) | `/subscriptions/:id`        | DELETE   | 删除订阅               |
| `/sendSwSubScription`      | `/subscriptions/:id/notify` | POST     | 发送通知               |
| `/openkey/generate`        | `/api-keys`                 | POST     | 生成API密钥            |
| `/openkey` (GET)           | `/api-keys`                 | GET      | 获取所有API密钥        |
| `/openkey` (POST)          | `/api-keys/:id`             | PUT      | 更新API密钥            |
| `/openkey` (DELETE)        | `/api-keys/:id`             | DELETE   | 删除API密钥            |
| `/upload`                  | `/attachments`              | POST     | 上传附件               |
| `/deleteAttachment`        | `/attachments/:id`          | DELETE   | 删除单个附件           |
| `/deleteAttachments`       | `/attachments`              | DELETE   | 批量删除附件           |
| `/sitemapData`             | `/site/sitemap`             | GET      | 获取站点地图数据       |
| `/status`                  | `/site/status`              | GET      | 获取站点状态           |
| `/rss/:username`           | `/users/:username/rss`      | GET      | 获取用户RSS            |

## API密钥接口重构

| 原API                     | 新API             | HTTP方法 | 描述                      |
| ------------------------- | ----------------- | -------- | ------------------------- |
| `/openKey/onerote` (GET)  | `/open-key/notes` | GET      | 使用API密钥创建笔记(兼容) |
| `/openKey/onerote` (POST) | `/open-key/notes` | POST     | 使用API密钥创建笔记       |
| `/openKey/myrote`         | `/open-key/notes` | GET      | 使用API密钥获取笔记       |

## 迁移建议

1. 保留原v1接口一段时间，同时提供新v2接口
2. 在文档中明确说明v1接口的废弃计划和v2接口的使用方式
3. 在前端逐步迁移到v2接口
4. 设置合理的过渡期，计划完全移除v1接口的时间表

## 后续优化方向

1. 考虑引入API版本控制头（Accept-Version或自定义头）
2. 完善错误处理和错误码体系
3. 实现参数验证中间件，确保请求数据的合法性
4. 增加接口速率限制，防止滥用
5. 增加API文档，如使用Swagger或OpenAPI规范自动生成文档
