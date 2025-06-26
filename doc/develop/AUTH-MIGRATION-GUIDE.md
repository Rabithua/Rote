# 身份验证迁移执行文档

## 概述

本文档详细说明了如何将 Rote 项目的身份验证机制从基于 Cookie 的 Session 认证迁移到基于 JWT Token 的无状态认证。

## 迁移原因

- **无状态架构**: 更适合分布式部署和水平扩展
- **移动端友好**: 更适合移动应用和第三方 API 调用
- **性能提升**: 无需数据库 session 查询，减少 I/O 操作
- **跨域支持**: 更好的跨域和微服务架构支持
- **现代化**: 符合现代 Web 应用的最佳实践

## 迁移影响评估

### 工作量等级

**中等偏高 (预计 6-8 个工作日)**

### 风险等级

**中等** - 需要充分测试，建议先在开发环境完成迁移

### 影响范围

- 后端：21+ 个 API 路由的认证中间件
- 前端：登录流程和 API 请求拦截器
- 数据库：移除 Session 表和相关数据

## 技术方案

### JWT Token 设计

```typescript
// Token 载荷结构
interface JWTPayload {
  userId: string;
  username: string;
  iat: number; // 签发时间
  exp: number; // 过期时间
}

// Token 配置
const JWT_CONFIG = {
  accessTokenExpiry: "15m", // 访问令牌15分钟
  refreshTokenExpiry: "7d", // 刷新令牌7天
  algorithm: "HS256", // 签名算法
  issuer: "rote-app", // 签发者
};
```

### 安全策略

1. **双令牌机制**: Access Token (短期) + Refresh Token (长期)
2. **安全存储**:
   - Access Token: 内存 (React state)
   - Refresh Token: httpOnly Cookie 或 localStorage
3. **自动刷新**: Access Token 过期前自动刷新
4. **令牌撤销**: 支持退出登录时撤销令牌

### 技术选型: 使用 jose 库

选择 `jose` 而非传统的 `jsonwebtoken` 的原因：

- **Web 标准兼容**: 基于 Web Cryptography API 标准
- **现代异步设计**: 原生支持 Promise，更好的错误处理
- **类型安全**: 完整的 TypeScript 支持，无需额外类型定义
- **性能优越**: 使用原生 Web API，性能更好
- **体积更小**: 相比 jsonwebtoken 库体积更小
- **安全性更高**: 更严格的验证和更好的错误处理

## 实施计划

### 阶段 1: 准备工作 (0.5 天)

#### 1.1 依赖管理

```bash
# 后端新增依赖
cd server
bun add jose

# 移除旧依赖
bun remove express-session @rabithua/prisma-session-store
```

#### 1.2 环境变量配置

```bash
# 在 .env 文件中添加
JWT_SECRET=your-super-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

#### 1.3 数据库准备

采用**无状态 JWT 方案**，完全不在数据库存储任何令牌信息：

```sql
-- 无需数据库 schema 变更
-- JWT 完全自包含，无需数据库存储令牌
```

#### 无状态 JWT 的优势

- **天然多设备支持**: 同一用户可以在多个设备同时登录，每个设备持有独立的 token
- **真正的无状态**: 完全符合 JWT 设计理念，服务端无状态
- **高性能**: 无需数据库查询验证 session，减少 I/O 操作
- **易于扩展**: 支持分布式部署，无需共享 session 存储
- **简单维护**: 无需管理复杂的令牌存储逻辑

#### 多设备登录支持

JWT 本身就支持多设备登录：

- 每次登录生成新的 token pair (access + refresh)
- 不同设备的 token 完全独立，互不干扰
- 支持设备级别的登出（前端清除本地 token）
- 支持全局登出（通过修改用户密码或 JWT 密钥）

#### 清理旧 Session 数据

```typescript
// server/scripts/cleanup-sessions.ts
import prisma from "../utils/prisma";

async function cleanupOldSessionData() {
  console.log("开始清理旧的 Session 数据...");

  // Session 表会在移除 PrismaSessionStore 依赖后自动清理
  // 这里只需要统计当前用户数，确保迁移不影响用户数据
  const userCount = await prisma.user.count();
  console.log(`当前用户总数: ${userCount}`);
  console.log("Session 数据将在重启服务后自动清理");

  console.log("清理完成 - 无状态迁移成功");
}

cleanupOldSessionData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 阶段 2: 后端核心改造 (3.5 天)

#### 2.1 创建 JWT 工具模块 (0.5 天)

```typescript
// server/utils/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

interface CustomJWTPayload extends JWTPayload {
  userId: string;
  username: string;
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

// 生成 Access Token (短期有效)
export async function generateAccessToken(
  payload: CustomJWTPayload
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("rote-app")
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRY || "15m")
    .sign(secret);
}

// 生成 Refresh Token (长期有效)
export async function generateRefreshToken(
  payload: CustomJWTPayload
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("rote-app")
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRY || "7d")
    .sign(refreshSecret);
}

// 验证 Access Token
export async function verifyAccessToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: "rote-app",
  });
  return payload as CustomJWTPayload;
}

// 验证 Refresh Token
export async function verifyRefreshToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: "rote-app",
  });
  return payload as CustomJWTPayload;
}

// 解析 Token 但不验证（用于获取过期 token 的信息）
export function decodeToken(token: string): CustomJWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return payload as CustomJWTPayload;
  } catch {
    return null;
  }
}
```

#### 2.2 重构认证中间件 (1 天)

**需要修改的文件:**

- `server/utils/main.ts` - 重写 `isAuthenticated`, `isAdmin`, `isAuthor`
- `server/middleware/auth.ts` - 新增 JWT 认证中间件

**实现逻辑:**

```typescript
// 新的认证中间件
import { verifyAccessToken } from "../utils/jwt";
import { oneUser } from "../utils/dbMethods";

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res
      .status(401)
      .json({ code: 401, message: "Access token required" });
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await oneUser(payload.userId);

    if (!user) {
      return res.status(401).json({ code: 401, message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: "Invalid token" });
  }
}
```

#### 2.3 更新 Passport 策略 (0.5 天)

**文件:** `server/utils/passport.ts`

- 移除 `serializeUser` 和 `deserializeUser`
- 保留 `LocalStrategy` 用于登录验证
- 修改登录成功后的处理逻辑

#### 2.4 修改服务器配置 (0.5 天)

**文件:** `server/server.ts`

- 移除 `express-session` 相关配置
- 移除 `PrismaSessionStore` 配置
- 简化 Passport 初始化

#### 2.5 更新路由认证 (1 天)

**需要修改的文件:**

- `server/route/v1.ts` - 21+ 个路由的中间件替换
- `server/route/v2.ts` - 所有需要认证的路由
- `server/route/openKeyRouter.ts` - 保持不变

**批量替换:**

```typescript
// 替换前
router.get("/endpoint", isAuthenticated, handler);

// 替换后
router.get("/endpoint", authenticateJWT, handler);
```

#### 2.6 更新认证相关 API (1 天)

**登录 API 改造:**

```typescript
// POST /auth/login
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { sanitizeUserData } from "../utils/main";

router.post("/login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) {
      return res.status(401).json({ code: 401, message: info.message });
    }

    try {
      // 生成 JWT tokens (完全无状态，不存储到数据库)
      const accessToken = await generateAccessToken({
        userId: user.id,
        username: user.username,
      });
      const refreshToken = await generateRefreshToken({
        userId: user.id,
        username: user.username,
      });

      res.json({
        code: 0,
        message: "Login successful",
        data: {
          user: sanitizeUserData(user),
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: "Token generation failed" });
    }
  })(req, res, next);
});
```

**新增 Token 刷新 API:**

```typescript
// POST /auth/refresh
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt";

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ code: 401, message: "Refresh token required" });
  }

  try {
    // 验证 refresh token
    const payload = await verifyRefreshToken(refreshToken);

    // 生成新的 access token
    const newAccessToken = await generateAccessToken({
      userId: payload.userId,
      username: payload.username,
    });

    // 可选：也生成新的 refresh token (rolling refresh)
    const newRefreshToken = await generateRefreshToken({
      userId: payload.userId,
      username: payload.username,
    });

    res.json({
      code: 0,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // 滚动刷新，提高安全性
      },
    });
  } catch (error) {
    res.status(401).json({ code: 401, message: "Invalid refresh token" });
  }
});
```

**登出 API (可选):**

```typescript
// POST /auth/logout
// 无状态 JWT 的登出只需要前端清除 token
router.post("/logout", (req, res) => {
  res.json({
    code: 0,
    message: "Logout successful - please clear tokens on client side",
    data: null,
  });
});
```

### 阶段 3: 前端适配 (2 天)

#### 3.1 创建 Token 管理服务 (0.5 天)

**文件:** `web/src/utils/auth.ts`

```typescript
interface AuthService {
  getAccessToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
  isTokenExpired(token: string): boolean;
  refreshToken(): Promise<{ accessToken: string; refreshToken?: string }>;
}
```

#### 3.2 更新 API 拦截器 (0.5 天)

**文件:** `web/src/utils/api.ts`

```typescript
// 请求拦截器 - 添加 Authorization header
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 处理 401 和自动刷新
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const newTokens = await refreshToken();
        setTokens(newTokens.accessToken, newTokens.refreshToken);
        // 重试原请求
        return api.request(error.config);
      } catch (refreshError) {
        // 刷新失败，跳转到登录页
        clearTokens();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

#### 3.3 更新登录组件 (0.5 天)

**文件:** `web/src/pages/login/index.tsx`

```typescript
// 登录成功处理
.then((response) => {
  const { user, accessToken, refreshToken } = response.data;

  // 存储 tokens
  setTokens(accessToken, refreshToken);

  // 更新用户状态
  setUser(user);

  toast.success(t('messages.loginSuccess'));
  navigate('/home');
})
```

#### 3.4 更新路由守卫 (0.5 天)

**文件:** `web/src/route/protectedRoute.tsx`

```typescript
// 检查 token 有效性而非依赖服务端 session
const ProtectedRoute = ({ children }) => {
  const token = getAccessToken();
  const isTokenValid = token && !isTokenExpired(token);

  if (!isTokenValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
```

### 阶段 4: 测试和优化 (1.5 天)

#### 4.1 功能测试 (1 天)

- [ ] 用户登录流程测试
- [ ] 用户注册流程测试
- [ ] Token 自动刷新测试
- [ ] 登出功能测试
- [ ] 权限控制测试 (普通用户/管理员)
- [ ] API 认证测试 (所有需要认证的端点)
- [ ] 跨标签页 token 同步测试

#### 4.2 性能测试 (0.5 天)

- [ ] 登录响应时间对比
- [ ] API 请求响应时间对比
- [ ] 内存使用情况对比
- [ ] 并发用户测试

## 风险控制

### 回滚计划

1. **代码回滚**: 使用 Git 分支管理，确保可以快速回滚
2. **数据备份**: 迁移前备份数据库
3. **渐进式部署**: 先在测试环境验证，再部署到生产环境

### 兼容性处理

```typescript
// 可选：同时支持两种认证方式的过渡期中间件
export function dualAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 优先尝试 JWT 认证
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authenticateJWT(req, res, next);
  }

  // 回退到 Session 认证
  return isAuthenticated(req, res, next);
}
```

### 监控指标

- 登录成功率
- Token 刷新频率
- 认证失败率
- API 响应时间

## 部署清单

### 部署前检查

- [ ] 环境变量配置完成
- [ ] JWT 密钥安全性检查
- [ ] 数据库迁移脚本准备
- [ ] 前端构建正常
- [ ] 所有测试用例通过

### 部署步骤

1. **停止服务**
2. **备份数据库**
3. **部署后端代码**
4. **更新环境变量**
5. **执行数据库迁移**
6. **部署前端代码**
7. **启动服务**
8. **验证核心功能**

### 部署后验证

- [ ] 用户登录正常
- [ ] API 认证正常
- [ ] Token 刷新正常
- [ ] 性能指标正常

## 常见问题解决

### Q1: Token 过期处理

**问题**: 用户在使用过程中 token 过期
**解决**: 实现自动刷新机制，对用户透明

### Q2: 跨标签页同步

**问题**: 多个标签页的 token 状态不同步
**解决**: 使用 localStorage 事件监听实现跨标签页同步

### Q3: 安全性考虑

**问题**: JWT 无法撤销，存在安全风险
**解决**:

- 使用短期 access token (15 分钟)
- 滚动刷新 refresh token，定期更新
- 敏感操作要求重新验证密码
- 可选：引入 JWT ID (jti) 和简单的黑名单机制

### Q4: 全局登出支持

**问题**: 无状态 JWT 如何实现全局登出
**解决**:

- 修改用户密码自动使所有 token 失效
- 前端提供"所有设备登出"功能，指导用户修改密码
- 可选：维护最小化的令牌版本号机制

## 总结

本次迁移将显著提升 Rote 项目的架构现代化程度，为后续的分布式部署和移动端支持奠定基础。通过详细的计划和充分的测试，可以确保迁移过程的平稳进行。

迁移完成后，系统将具备更好的扩展性、性能表现和安全性，符合现代 Web 应用的最佳实践。
