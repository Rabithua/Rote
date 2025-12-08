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

- OAuth 用户（纯 OAuth 用户，无密码）不能使用密码登录
- OAuth 用户不能修改密码
- 如果 GitHub 账户的邮箱已被其他本地账户使用，会返回错误：`该邮箱已被其他账户使用，请使用用户名密码登录后关联 GitHub 账户`
- 如果 GitHub 账户已被其他用户绑定，会提示需要合并账户
- 回调 URL 必须在 GitHub OAuth App 中配置，且必须是后端 URL（例如：`https://your-domain.com/v2/api/auth/oauth/github/callback`）
- 已绑定 GitHub 的本地账户可以使用密码或 GitHub 两种方式登录

---

### 1.2) 绑定 GitHub 账户到现有账户

已登录的用户可以将 GitHub 账户绑定到现有账户，实现多种登录方式。

**绑定流程**：

1. **发起绑定**：调用 `GET /v2/api/auth/oauth/github/bind` 获取 GitHub 授权 URL
2. **GitHub 授权**：用户被重定向到 GitHub 进行授权
3. **回调处理**：授权成功后，GitHub 重定向到配置的回调地址
4. **处理结果**：
   - 如果 GitHub 账户未被使用：直接绑定成功
   - 如果 GitHub 账户已被其他用户使用：返回合并确认信息，需要用户确认合并

**接口说明**：

- **方法**: GET
- **URL**: `/v2/api/auth/oauth/github/bind`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）
- **Query 参数**:
  - `redirect`（可选）：绑定成功后的重定向地址，必须是相对路径（以 `/` 开头），默认为 `/profile`

**请求示例**：

```bash
curl -X GET 'https://your-domain.com/v2/api/auth/oauth/github/bind?redirect=/profile' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

**成功响应示例（200）**：

```json
{
  "code": 0,
  "message": "Redirect to GitHub for authorization",
  "data": {
    "redirectUrl": "https://github.com/login/oauth/authorize?..."
  }
}
```

**错误响应**：

- 400 用户已绑定 GitHub 账户（提示：`您已绑定 GitHub 账户，请先解绑后再绑定新的账户`）
- 401 未认证（需要登录）

**回调处理**：

- **直接绑定成功**：重定向到 `{frontendUrl}{redirect}?oauth=bind&bind=success`
- **需要合并账户**：重定向到 `{frontendUrl}{redirect}?oauth=bind&bind=merge_required&existingUserId={userId}&existingUsername={username}&existingEmail={email}&githubUserId={githubId}`
- **绑定失败**：重定向到 `{frontendUrl}{redirect}?oauth=bind&bind=error&message={errorMessage}`

**合并账户确认接口**：

当 GitHub 账户已被其他用户使用时，需要调用此接口确认合并：

- **方法**: POST
- **URL**: `/v2/api/auth/oauth/github/bind/merge`
- **Headers**:
  - `Authorization: Bearer <accessToken>`（必填）
  - `Content-Type: application/json`
- **Body**:
  - `existingUserId`: string（必填，已绑定该 GitHub 账户的用户 ID）
  - `githubUserId`: string（必填，GitHub 用户 ID）

**请求示例**：

```bash
curl -X POST 'https://your-domain.com/v2/api/auth/oauth/github/bind/merge' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "existingUserId": "uuid-of-existing-user",
    "githubUserId": "12345678"
  }'
```

**成功响应示例（200）**：

```json
{
  "code": 0,
  "message": "账户合并成功，GitHub 已绑定",
  "data": {
    "merged": true,
    "mergedData": {
      "notes": 10,
      "attachments": 5,
      "reactions": 3,
      "openKeys": 2,
      "subscriptions": 1,
      "changes": 15
    }
  }
}
```

**错误响应**：

- 400 参数缺失（`Missing required parameters`）
- 400 目标账户已绑定其他 GitHub 账户（提示：`目标账户已绑定其他 GitHub 账户，请先解绑`）
- 400 您已绑定此 GitHub 账户（提示：`您已绑定此 GitHub 账户`）
- 400 GitHub ID 不匹配（提示：`GitHub ID mismatch`）
- 400 不能合并自己（提示：`Cannot merge account with itself`）
- 404 用户不存在（提示：`Target user not found` 或 `Existing user not found`）
- 500 合并失败（提示：`账户合并失败：源账户未被删除`）

**合并说明**：

- 合并操作会将源账户的所有数据（笔记、附件、反应、API 密钥等）迁移到目标账户
- 合并后，源账户会被删除
- 合并操作是原子性的，要么全部成功，要么全部回滚
- 合并后，目标账户会绑定该 GitHub 账户，可以使用 GitHub 登录

---

### 1.3) 解绑 GitHub 账户

已绑定 GitHub 账户的用户可以解绑，但需要确保有其他登录方式（密码或其他 OAuth 提供商）。

**接口说明**：

- **方法**: DELETE
- **URL**: `/v2/api/auth/oauth/github/bind`
- **Headers**: `Authorization: Bearer <accessToken>`（必填）

**请求示例**：

```bash
curl -X DELETE 'https://your-domain.com/v2/api/auth/oauth/github/bind' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

**成功响应示例（200）**：

```json
{
  "code": 0,
  "message": "GitHub 账户已解绑",
  "data": null
}
```

**错误响应**：

- 400 用户未绑定 GitHub 账户（提示：`您尚未绑定 GitHub 账户`）
- 400 无法解绑（提示：`无法解绑：您没有设置密码，解绑后将无法登录`）
- 401 未认证（需要登录）

**注意事项**：

- 如果用户没有设置密码且 `authProvider` 为 `'github'`，则不允许解绑，避免账户被锁定
- 解绑后，`authProviderId` 会被清除，`authProvider` 会从 `'github'` 改为 `'local'`（如果之前是 `'github'`）
- 解绑后，用户仍可以使用密码登录（如果有密码）

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
  - **本地账户**：通过用户名密码注册/登录，可以修改密码，可以绑定 GitHub 账户实现多种登录方式
  - **OAuth 账户**：通过 GitHub 等第三方登录，不能使用密码登录，不能修改密码
  - **混合账户**：本地账户绑定 GitHub 后，可以使用密码或 GitHub 两种方式登录
