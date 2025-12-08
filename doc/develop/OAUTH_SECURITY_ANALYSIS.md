# OAuth 登录安全分析报告

## 概述

本文档分析了 GitHub OAuth 登录实现中的潜在安全漏洞和风险点。

## 发现的潜在漏洞

### 1. ⚠️ 开放重定向漏洞（Open Redirect）

**位置**: `server/route/v2/oauth.ts:52`

**问题**:

```typescript
const redirectUrl = c.req.query("redirect") || "/login";
```

`redirectUrl` 直接从查询参数获取，没有验证是否为合法的内部 URL，可能导致开放重定向攻击。

**风险等级**: 中

**攻击场景**:

```
https://yourdomain.com/v2/api/auth/oauth/github?redirect=https://evil.com/phishing
```

**建议修复**:

- 验证 `redirectUrl` 必须是相对路径（以 `/` 开头）
- 或者维护一个允许的重定向 URL 白名单
- 从 state token 中读取 redirectUrl（已在 state 中存储，但未使用）

### 2. ⚠️ Token 在 URL 中传递

**位置**: `server/route/v2/oauth.ts:194-195`

**问题**:

```typescript
loginUrl.searchParams.set("token", jwtAccessToken);
loginUrl.searchParams.set("refreshToken", jwtRefreshToken);
```

JWT token 通过 URL 参数传递，可能被记录在：

- 浏览器历史记录
- 服务器访问日志
- HTTP Referer 头
- 浏览器开发者工具

**风险等级**: 中高

**建议修复**:

- 使用一次性 token（session token）在 URL 中传递
- 前端通过该 token 调用 API 获取实际的 JWT token
- 或者使用 POST 请求 + HTTP-only cookie（需要 CORS 配置）

### 3. ⚠️ 邮箱冲突处理不完善

**位置**: `server/route/v2/oauth.ts:126-136`

**问题**:
当邮箱已被其他账户使用时，直接抛出错误，没有考虑以下场景：

- 用户之前用邮箱注册，现在想用 GitHub 登录（账户合并）
- 用户可能希望关联多个 OAuth 提供商到同一账户

**风险等级**: 低（功能性问题）

**建议修复**:

- 提供账户关联功能
- 或者允许用户选择合并账户或创建新账户

### 4. ⚠️ 并发创建用户的竞态条件

**位置**: `server/route/v2/oauth.ts:146-166`

**问题**:
虽然有处理 `23505` 错误（唯一约束冲突），但在高并发情况下：

- 多个请求同时检查用户不存在
- 同时尝试创建用户
- 只有一个成功，其他需要重试

**风险等级**: 低（已有处理，但可能影响性能）

**建议修复**:

- 使用数据库事务和锁
- 或者使用 `INSERT ... ON CONFLICT DO NOTHING` 然后查询

### 5. ⚠️ 临时邮箱可能冲突

**位置**: `server/route/v2/oauth.ts:143`

**问题**:

```typescript
const email = githubUser.email || `github-${githubUser.id}@temp.rote.local`;
```

如果两个不同的 GitHub 用户都没有邮箱（理论上不可能，因为 GitHub ID 唯一），但代码逻辑上如果 `githubUser.id` 为空或未定义，可能生成相同的临时邮箱。

**风险等级**: 极低（GitHub ID 总是存在且唯一）

**建议修复**:

- 添加对 `githubUser.id` 的验证
- 确保临时邮箱格式唯一

### 6. ⚠️ 错误信息可能泄露敏感信息

**位置**: `server/route/v2/oauth.ts:200-208`

**问题**:
错误信息直接返回给前端，可能泄露：

- 内部错误详情
- 数据库错误信息
- 系统配置信息

**风险等级**: 低

**建议修复**:

- 区分用户友好错误和系统错误
- 系统错误只记录日志，不返回给前端
- 使用通用错误消息

### 7. ⚠️ State Token 过期时间可能过长

**位置**: `server/utils/oauth.ts:23`

**问题**:

```typescript
const expiresIn = options?.expiresIn || "10m"; // 默认 10 分钟过期
```

10 分钟可能过长，增加了 token 被截获和重放的风险。

**风险等级**: 低

**建议修复**:

- 缩短过期时间到 5 分钟
- State token 是一次性的，使用后应该立即失效（当前未实现）

### 8. ⚠️ State Token 未实现一次性使用

**位置**: `server/utils/oauth.ts`

**问题**:
State token 验证后没有标记为已使用，理论上可以被重放（虽然过期时间限制了风险）。

**风险等级**: 低

**建议修复**:

- 使用 Redis 或数据库存储已使用的 state token
- 或者使用 nonce 机制

### 9. ⚠️ 用户名生成函数的竞态条件

**位置**: `server/utils/dbMethods/user.ts:154-171`

**问题**:
`generateUniqueUsername` 函数在检查用户名可用性和创建用户之间存在时间窗口，高并发时可能创建重复用户名。

**风险等级**: 低（数据库唯一约束会捕获）

**建议修复**:

- 依赖数据库唯一约束（当前已有）
- 或者使用数据库锁

### 10. ⚠️ iOS 自定义 Scheme 重定向未验证

**位置**: `server/route/v2/oauth.ts:184`

**问题**:

```typescript
const callbackUrl = `rote://callback?token=${jwtAccessToken}&refreshToken=${jwtRefreshToken}`;
```

虽然这是预期的行为（iOS 应用需要），但应该确保只在 `iosLogin === true` 时才使用。

**风险等级**: 低（已有条件检查）

**建议修复**:

- 确保 `iosLogin` 标志来自可信的 state token
- 添加额外的验证

## 已实现的安全措施 ✅

1. **CSRF 保护**: 使用 JWT 签名的 state token
2. **State Token 验证**: 验证签名、过期时间和 issuer
3. **唯一约束**: 数据库层面的用户名和邮箱唯一性保证
4. **错误处理**: 捕获和处理各种错误情况
5. **配置验证**: 验证 OAuth 配置完整性

## 优先级修复建议

### 高优先级

1. **修复开放重定向漏洞** - 验证 redirectUrl
2. **改进 Token 传递方式** - 使用一次性 token 或 POST + cookie

### 中优先级

3. **缩短 State Token 过期时间** - 改为 5 分钟
4. **改进错误处理** - 避免泄露敏感信息

### 低优先级

5. **实现 State Token 一次性使用**
6. **改进邮箱冲突处理** - 提供账户关联功能

## 测试建议

1. **安全测试**:

   - 测试开放重定向攻击
   - 测试 State token 重放攻击
   - 测试并发创建用户

2. **功能测试**:

   - 测试用户名冲突处理
   - 测试邮箱冲突处理
   - 测试 iOS 登录流程

3. **性能测试**:
   - 测试高并发 OAuth 登录
   - 测试用户名生成性能
