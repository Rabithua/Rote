## 登录与令牌使用指南

本指南面向对接方，说明如何使用登录相关接口进行身份认证与令牌续期。仅包含使用方法与示例，不涉及实现细节。

### 基础信息

- **基础路径**: `/v2/api`
- **统一响应**: `{ code: number, message: string, data: any }`（`code=0` 表示成功）
- **认证方式**: 在需要鉴权的接口，加请求头 `Authorization: Bearer <accessToken>`

---

### 1) 登录获取令牌

- **方法**: POST
- **URL**: `/v2/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body**:
  - `username`: string
  - `password`: string

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "demo",
    "password": "your_password"
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "username": "demo",
      "email": "demo@example.com",
      "nickname": "Demo",
      "description": "用户简介",
      "avatar": "https://example.com/avatar.jpg",
      "cover": "https://example.com/cover.jpg",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "<ACCESS_TOKEN>",
    "refreshToken": "<REFRESH_TOKEN>"
  }
}
```

可能的错误：

- 401 未认证（用户名或密码错误）
- 503 服务未就绪（安全配置未完成）

---

### 2) 使用 accessToken 访问受保护资源

在需要鉴权的接口，请在请求头中携带 `Authorization: Bearer <accessToken>`。

示例：获取当前用户资料

- **方法**: GET
- **URL**: `/v2/api/users/me/profile`

请求示例（cURL）:

```bash
curl -X GET 'https://your-domain.com/v2/api/users/me/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

可能的错误：

- 401 令牌缺失或无效

---

### 3) 刷新令牌（获取新的 accessToken 与 refreshToken）

- **方法**: POST
- **URL**: `/v2/api/auth/refresh`
- **Headers**: `Content-Type: application/json`
- **Body**:
  - `refreshToken`: string（登录时返回）

请求示例（cURL）:

```bash
curl -X POST 'https://your-domain.com/v2/api/auth/refresh' \
  -H 'Content-Type: application/json' \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "<NEW_ACCESS_TOKEN>",
    "refreshToken": "<NEW_REFRESH_TOKEN>"
  }
}
```

可能的错误：

- 401 `refreshToken` 缺失或无效
- 503 服务未就绪（安全配置未完成）

---

### 客户端使用建议

- **令牌存储**: 仅在受信任环境安全存储，避免泄露。
- **续期策略**: 出现 401（令牌过期/无效）时，优先调用刷新接口获取新令牌；若刷新失败，提示用户重新登录。
- **请求头规范**: 必须使用 `Authorization: Bearer <accessToken>` 格式。
