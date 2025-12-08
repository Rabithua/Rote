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
- 401 OAuth 账户不能使用密码登录（提示：`This account uses OAuth login. Please use GitHub to sign in.`）
- 503 服务未就绪（安全配置未完成）

---

### 1.1) GitHub OAuth 登录

Rote 支持通过 GitHub OAuth 进行第三方登录。OAuth 登录流程如下：

1. **发起授权**：用户访问 `/v2/api/auth/oauth/github`
2. **GitHub 授权**：用户被重定向到 GitHub 进行授权
3. **回调处理**：授权成功后，GitHub 重定向到配置的回调地址 `/v2/api/auth/oauth/github/callback`
4. **获取 Token**：回调处理完成后，用户被重定向到前端页面，URL 中包含 `token` 和 `refreshToken` 参数

**查询参数**（发起授权时）：

- `redirect`（可选）：授权成功后的重定向地址，必须是相对路径（以 `/` 开头），默认为 `/login`
- `type`（可选）：设置为 `ioslogin` 时，表示 iOS 应用登录流程

**请求示例**：

```bash
# Web 登录
curl -L 'https://your-domain.com/v2/api/auth/oauth/github?redirect=/dashboard'

# iOS 应用登录
curl -L 'https://your-domain.com/v2/api/auth/oauth/github?type=ioslogin&redirect=/login'
```

**回调响应**：

- **Web 登录**：重定向到前端页面，URL 格式：`{frontendUrl}{redirect}?oauth=success&token={accessToken}&refreshToken={refreshToken}`
- **iOS 登录**：重定向到自定义 Scheme，URL 格式：`rote://callback?token={accessToken}&refreshToken={refreshToken}`

**错误处理**：

- 用户取消授权：重定向到 `{frontendUrl}/login?oauth=cancelled`
- OAuth 错误：重定向到 `{frontendUrl}/login?oauth=error&message={errorMessage}`

**注意事项**：

- OAuth 用户不能使用密码登录
- OAuth 用户不能修改密码
- 如果 GitHub 账户的邮箱已被其他本地账户使用，会返回错误：`该邮箱已被其他账户使用，请使用用户名密码登录后关联 GitHub 账户`
- 回调 URL 必须在 GitHub OAuth App 中配置，且必须是后端 URL（例如：`https://your-domain.com/v2/api/auth/oauth/github/callback`）

---

### 2) 修改密码（仅限本地账户）

- **方法**: PUT
- **URL**: `/v2/api/auth/password`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <accessToken>`
- **Body**:
  - `oldpassword`: string（当前密码）
  - `newpassword`: string（新密码，至少 6 位，最长 128 位）

请求示例（cURL）:

```bash
curl -X PUT 'https://your-domain.com/v2/api/auth/password' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -d '{
    "oldpassword": "old_password",
    "newpassword": "new_strong_password"
  }'
```

成功响应示例（200）：

```json
{
  "code": 0,
  "message": "Password updated successfully",
  "data": {
    "id": "uuid",
    "username": "demo",
    "email": "demo@example.com",
    ...
  }
}
```

可能的错误：

- 401 未认证（Token 无效）
- 400 OAuth 用户不能修改密码（提示：`OAuth users cannot change password. Please use OAuth login.`）
- 400 密码验证失败（密码长度不符合要求等）

---

### 3) 使用 accessToken 访问受保护资源

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

### 4) 刷新令牌（获取新的 accessToken 与 refreshToken）

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
- **账户类型**：
  - **本地账户**：通过用户名密码注册/登录，可以修改密码
  - **OAuth 账户**：通过 GitHub 等第三方登录，不能使用密码登录，不能修改密码
