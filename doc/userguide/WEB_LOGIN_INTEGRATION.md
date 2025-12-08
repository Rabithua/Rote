# iOS 应用网页登录集成指南

本文档旨在为 Web 开发团队提供与 iOS 端集成的详细说明，以实现通过 `ASWebAuthenticationSession` 进行的用户认证流程。

## 1. 认证流程概述

当 iOS 用户点击“通过网页登录”按钮时，应用会打开一个安全的应用内浏览器（由 `ASWebAuthenticationSession` 提供），并加载您指定的网页。用户在该网页上完成认证后，网页服务器需要将认证凭据（例如 Token）通过特定的 URL Scheme 回传给 iOS 应用。iOS 应用会拦截这个 URL，解析出凭据，并完成登录。

**核心流程**：

1.  iOS App 打开 `https://rote.ink/login?type=ioslogin`。
2.  用户在网页上完成登录操作（例如，输入用户名/密码，或通过第三方 OAuth 登录）。
3.  Web 服务器验证成功后，**必须通过 HTTP 302 重定向** 到一个特定的 URL，该 URL 使用 iOS App 的自定义 Scheme `rote://`。
4.  iOS App 监听到这个重定向，关闭浏览器，并从 URL 中提取 Token。

---

## 2. Web 端需要实现的关键步骤

### 步骤 1：创建登录入口页面

您需要确保以下 URL 是一个有效的、可供用户登录的页面：

```
https://rote.ink/login?type=ioslogin
```

iOS 应用会直接打开这个地址。您可以利用 `type=ioslogin` 这个查询参数来为来自 App 的请求展示特定的 UI（例如，隐藏“注册”按钮或导航栏）。

### 步骤 2：处理用户认证

用户在此页面上进行的所有认证操作（如表单提交、与第三方 OAuth 提供商交互等）均由您的服务器处理。这部分是标准的 Web 认证流程。

**支持的登录方式**：

1. **用户名密码登录**：通过 `/v2/api/auth/login` 接口进行认证
2. **GitHub OAuth 登录**：通过 `/v2/api/auth/oauth/github` 接口发起授权

**GitHub OAuth 登录流程**：

- 用户点击 GitHub 登录按钮后，重定向到 `/v2/api/auth/oauth/github?type=ioslogin&redirect=/login`
- 服务器会重定向到 GitHub 授权页面
- 用户授权后，GitHub 会回调到 `/v2/api/auth/oauth/github/callback`
- 服务器处理回调，生成 Token，然后重定向到 iOS App 的自定义 Scheme

### 步骤 3：成功后的重定向（最关键的一步）

当用户在您的服务器上成功认证后，服务器 **必须** 生成一个认证 Token (例如 JWT)，然后构造一个回调 URL，并执行 **HTTP 302 重定向**。

**回调 URL 的格式必须如下**：

```
rote://callback?token=YOUR_GENERATED_TOKEN&refreshToken=YOUR_REFRESH_TOKEN
```

**URL 构成详解**：

- **Scheme**: `rote://`
  - 这是在 iOS 应用中预先定义好的，用于唤醒应用的协议。**必须**是这个值。
- **Host**: `callback`
  - 这部分可以自定义（例如 `auth`, `login-success` 等），但建议使用 `callback`。iOS 端目前没有严格校验 Host，但会解析整个 URL。
- **Query Parameters**:
  - `token=YOUR_GENERATED_TOKEN`：这是最重要的部分。iOS 应用会专门查找名为 `token` 的查询参数来获取认证凭据。**参数名必须是 `token`**。
  - `refreshToken=YOUR_REFRESH_TOKEN`（可选但推荐）：刷新令牌，用于在 accessToken 过期后获取新的令牌。

**服务器端实现示例 (使用 Express.js)**：

```javascript
const express = require("express");
const app = express();

// 伪代码：处理登录请求的路由
app.post("/login-handler", (req, res) => {
  // 1. 验证用户凭据 (req.body.username, req.body.password)
  const userIsValid = validateUser(req.body);

  if (userIsValid) {
    // 2. 如果验证成功，生成 Token
    const jwtToken = generateJwtForUser(req.body.username);

    // 3. 生成 refreshToken（可选但推荐）
    const refreshToken = generateRefreshToken(req.body.username);

    // 4. 构造回调 URL
    const callbackUrl = `rote://callback?token=${jwtToken}&refreshToken=${refreshToken}`;

    // 5. 执行重定向
    res.redirect(callbackUrl);
  } else {
    // 处理登录失败的情况
    res.status(401).send("Authentication failed");
  }
});

// ... 其他代码 ...
```

---

## 3. 流程总结

| 步骤 | 操作方     | 描述                                                                                                                            |
| :--- | :--------- | :------------------------------------------------------------------------------------------------------------------------------ |
| 1    | iOS App    | 用户点击登录，打开 `https://rote.ink/login?type=ioslogin`                                                                       |
| 2    | 用户       | 在网页上输入凭据（或通过 GitHub OAuth）进行登录                                                                                 |
| 3    | Web Server | 验证用户凭据，生成 Token 和 RefreshToken                                                                                        |
| 4    | Web Server | **关键**：返回 HTTP 302 响应，`Location` 头指向 `rote://callback?token=...&refreshToken=...`                                    |
| 5    | iOS App    | `ASWebAuthenticationSession` 自动拦截重定向，关闭浏览器，将回调 URL `rote://callback?token=...&refreshToken=...` 传递给应用代码 |
| 6    | iOS App    | 解析 URL，提取 `token` 和 `refreshToken` 参数，保存 Token 并完成登录                                                            |

**GitHub OAuth 登录流程**：

| 步骤 | 操作方     | 描述                                                                                                 |
| :--- | :--------- | :--------------------------------------------------------------------------------------------------- |
| 1    | iOS App    | 用户点击 GitHub 登录，打开 `https://rote.ink/v2/api/auth/oauth/github?type=ioslogin&redirect=/login` |
| 2    | Web Server | 重定向到 GitHub 授权页面                                                                             |
| 3    | 用户       | 在 GitHub 上完成授权                                                                                 |
| 4    | GitHub     | 重定向回 `/v2/api/auth/oauth/github/callback`，携带授权码                                            |
| 5    | Web Server | 交换授权码获取 Token，生成 JWT Token 和 RefreshToken                                                 |
| 6    | Web Server | **关键**：返回 HTTP 302 响应，`Location` 头指向 `rote://callback?token=...&refreshToken=...`         |
| 7    | iOS App    | `ASWebAuthenticationSession` 自动拦截重定向，关闭浏览器，提取 Token 并完成登录                       |

请确保 Web 端的实现在用户成功登录后，严格按照上述格式执行重定向。这是整个认证流程能够闭环的关键。
