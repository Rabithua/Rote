# JWT 身份验证迁移 - 渐进式施工清单

## 📋 施工准备

### ✅ 前置检查

- [ ] 确认当前项目可以正常运行
- [ ] 创建新的 Git 分支 `feature/jwt-auth-migration`
- [ ] 备份当前数据库
- [ ] 准备开发环境测试

```bash
# 创建分支并切换
git checkout -b feature/jwt-auth-migration

# 确认当前服务状态
cd /Users/rabithua/Documents/Github/Rote/server && bun run dev
cd /Users/rabithua/Documents/Github/Rote/web && bun run dev
```

---

## 🔧 阶段一：基础准备 (预计 2-3 小时)

### Step 1: 依赖管理

- [ ] 安装 jose 库
- [ ] 移除旧的 session 依赖
- [ ] 验证依赖安装成功

```bash
# 后端依赖
cd server
bun add jose
bun remove express-session @rabithua/prisma-session-store

# 验证安装
bun run dev # 确认服务启动正常
```

### Step 2: 环境变量配置

- [ ] 生成 JWT 密钥
- [ ] 配置 .env 文件
- [ ] 验证环境变量加载

```bash
# 生成强密钥
openssl rand -base64 64

# 添加到 server/.env
JWT_SECRET=生成的密钥1
JWT_REFRESH_SECRET=生成的密钥2
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

### Step 3: 创建 JWT 工具模块

- [ ] 创建 `server/utils/jwt.ts` 文件
- [ ] 实现基本的 token 生成和验证函数
- [ ] 编写简单测试验证功能

**创建文件:**

```typescript
// server/utils/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

interface CustomJWTPayload extends JWTPayload {
  userId: string;
  username: string;
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

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

export async function verifyAccessToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, secret, { issuer: "rote-app" });
  return payload as CustomJWTPayload;
}

export async function verifyRefreshToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: "rote-app",
  });
  return payload as CustomJWTPayload;
}
```

**测试验证:**

```typescript
// server/scripts/test-jwt.ts (临时测试文件)
import { generateAccessToken, verifyAccessToken } from "../utils/jwt";

async function testJWT() {
  try {
    const token = await generateAccessToken({
      userId: "test",
      username: "test",
    });
    console.log("生成 Token:", token);

    const payload = await verifyAccessToken(token);
    console.log("验证成功:", payload);
  } catch (error) {
    console.error("JWT 测试失败:", error);
  }
}

testJWT();
```

**验证点:**

- [ ] JWT 工具函数创建成功
- [ ] 测试脚本运行通过
- [ ] 服务启动无错误

---

## 🔨 阶段二：认证中间件改造 (预计 3-4 小时)

### Step 4: 创建新的认证中间件

- [ ] 创建 JWT 认证中间件
- [ ] 先不替换现有中间件，并行存在
- [ ] 测试新中间件功能

**创建文件:**

```typescript
// server/middleware/jwtAuth.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { oneUser } from "../utils/dbMethods";

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

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

### Step 5: 修改登录 API

- [ ] 更新登录接口返回 JWT
- [ ] 保持向后兼容（同时支持 session）
- [ ] 测试登录功能

**修改登录 API:**

```typescript
// 在 server/route/v2.ts 中添加新的登录逻辑
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";

// 先添加新的 JWT 登录端点，不影响现有的
router.post("/auth/jwt-login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) {
      return res.status(401).json({ code: 401, message: info.message });
    }

    try {
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
        message: "JWT Login successful",
        data: { user: sanitizeUserData(user), accessToken, refreshToken },
      });
    } catch (error) {
      res.status(500).json({ code: 500, message: "Token generation failed" });
    }
  })(req, res, next);
});
```

**验证点:**

- [ ] 新的 JWT 登录端点工作正常
- [ ] 可以成功生成和返回 token
- [ ] 原有登录功能不受影响

---

## 🔄 阶段三：前端适配 (预计 4-5 小时)

### Step 6: 创建 Token 管理工具

- [ ] 创建前端 token 管理服务
- [ ] 实现 token 存储和获取
- [ ] 添加 token 过期检查

**创建文件:**

```typescript
// web/src/utils/auth.ts
// Token 管理服务
class AuthService {
  private ACCESS_TOKEN_KEY = "rote_access_token";
  private REFRESH_TOKEN_KEY = "rote_refresh_token";

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

export const authService = new AuthService();
```

### Step 7: 更新 API 拦截器

- [ ] 修改请求拦截器添加 Authorization header
- [ ] 添加响应拦截器处理 401 错误
- [ ] 实现自动 token 刷新

**修改 API 拦截器:**

```typescript
// web/src/utils/api.ts 中添加
import { authService } from "./auth";

// 请求拦截器更新
api.interceptors.request.use(
  (config) => {
    // 现有逻辑保持不变
    if (config.url && !config.url.startsWith("http")) {
      config.url = `${API_PATH}${
        config.url.startsWith("/") ? config.url : `/${config.url}`
      }`;
    }

    // 新增：添加 JWT token
    const token = authService.getAccessToken();
    if (token && !authService.isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);
```

### Step 8: 添加 JWT 登录测试

- [ ] 在登录页面添加 JWT 登录选项
- [ ] 测试 JWT 登录流程
- [ ] 验证 token 存储和使用

**添加测试按钮:**

```typescript
// 在 web/src/pages/login/index.tsx 中添加测试功能
function testJWTLogin() {
  setDisabled(true);
  post("/auth/jwt-login", loginData)
    .then((response) => {
      const { user, accessToken, refreshToken } = response.data;

      // 存储 tokens
      authService.setTokens(accessToken, refreshToken);

      toast.success("JWT 登录成功");
      navigate("/home");
    })
    .catch((err) => {
      console.error("JWT 登录失败:", err);
      toast.error("JWT 登录失败");
    })
    .finally(() => setDisabled(false));
}

// 添加测试按钮（开发环境）
{
  process.env.NODE_ENV === "development" && (
    <Button onClick={testJWTLogin} variant="outline">
      JWT 登录测试
    </Button>
  );
}
```

**验证点:**

- [ ] JWT 登录流程完整
- [ ] Token 正确存储到 localStorage
- [ ] 后续请求携带 Authorization header

---

## 🔀 阶段四：渐进式替换 (预计 3-4 小时)

### Step 9: 创建双重认证中间件

- [ ] 实现同时支持 Session 和 JWT 的中间件
- [ ] 优先使用 JWT，回退到 Session
- [ ] 在少数路由上测试

**创建双重认证中间件:**

```typescript
// server/middleware/dualAuth.ts
import { Request, Response, NextFunction } from "express";
import { authenticateJWT } from "./jwtAuth";
import { isAuthenticated } from "../utils/main";

export function dualAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 如果有 Authorization header，优先使用 JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticateJWT(req, res, next);
  }

  // 否则回退到 Session 认证
  return isAuthenticated(req, res, next);
}
```

### Step 10: 在测试路由上应用

- [ ] 选择 2-3 个不重要的路由进行测试
- [ ] 替换为双重认证中间件
- [ ] 验证两种认证方式都能工作

**测试替换:**

```typescript
// server/route/v2.ts 中选择测试路由
// 原来: router.get('/test-endpoint', isAuthenticated, handler);
// 改为: router.get('/test-endpoint', dualAuthMiddleware, handler);
```

**验证点:**

- [ ] Session 用户仍能正常访问
- [ ] JWT 用户也能正常访问
- [ ] 错误处理正确

---

## 🚀 阶段五：全面切换 (预计 4-5 小时)

### Step 11: 批量替换路由中间件

- [ ] 统计所有使用 `isAuthenticated` 的路由
- [ ] 分批替换为 JWT 认证
- [ ] 每替换一批就测试一次

**批量替换脚本:**

```bash
# 查找所有使用 isAuthenticated 的地方
grep -r "isAuthenticated" server/route/

# 分批替换
# 1. 先替换 v2 路由
# 2. 再替换 v1 路由
# 3. 最后处理特殊情况
```

### Step 12: 更新服务器配置

- [ ] 移除 express-session 配置
- [ ] 简化 passport 初始化
- [ ] 清理不需要的中间件

**修改 server.ts:**

```typescript
// 注释或移除这些配置
/*
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET || 'sessionSecret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 31 * 24 * 60 * 60 * 1000 },
    store: new PrismaSessionStore({
      prisma: prisma,
      checkPeriod: 2 * 60 * 1000,
    }),
  })
);
*/

// 保留但简化
app.use(passport.initialize());
// app.use(passport.session()); // 注释掉
```

### Step 13: 更新前端登录逻辑

- [ ] 将主登录接口切换到 JWT
- [ ] 添加 token 刷新机制
- [ ] 更新登出逻辑

**切换主登录:**

```typescript
// web/src/pages/login/index.tsx
// 将原来的 post('/auth/login', loginData)
// 改为 post('/auth/jwt-login', loginData)

function login() {
  // ... 验证逻辑 ...

  setDisabled(true);
  post("/auth/jwt-login", loginData) // 改为 JWT 登录
    .then((response) => {
      const { user, accessToken, refreshToken } = response.data;

      authService.setTokens(accessToken, refreshToken);
      toast.success(t("messages.loginSuccess"));
      mutate(); // 更新用户状态
      navigate("/home");
    })
    .catch((err) => {
      // 错误处理...
    })
    .finally(() => setDisabled(false));
}
```

**验证点:**

- [ ] 主登录流程使用 JWT
- [ ] 所有 API 请求携带正确的 token
- [ ] 用户状态正确更新

---

## 🧪 阶段六：全面测试 (预计 3-4 小时)

### Step 14: 功能完整性测试

- [ ] 用户注册流程
- [ ] 用户登录流程
- [ ] 权限控制 (普通用户/管理员)
- [ ] 所有需要认证的 API 端点
- [ ] 登出功能

**测试清单:**

```typescript
// 创建测试脚本 server/scripts/test-auth.ts
async function testAuthFlow() {
  console.log("🧪 开始认证系统测试...");

  // 1. 测试 JWT 生成
  console.log("1. 测试 JWT 生成...");
  // ...

  // 2. 测试登录接口
  console.log("2. 测试登录接口...");
  // ...

  // 3. 测试认证中间件
  console.log("3. 测试认证中间件...");
  // ...

  console.log("✅ 所有测试通过!");
}
```

### Step 15: 性能测试

- [ ] 登录响应时间对比
- [ ] API 请求响应时间对比
- [ ] 内存使用情况
- [ ] 并发用户测试

### Step 16: 安全性验证

- [ ] Token 过期处理
- [ ] 无效 token 处理
- [ ] 权限边界测试
- [ ] 跨域请求测试

---

## 🔧 阶段七：优化和清理 (预计 2-3 小时)

### Step 17: 代码清理

- [ ] 移除旧的 session 相关代码
- [ ] 清理临时测试文件
- [ ] 优化错误处理
- [ ] 添加日志记录

**清理清单:**

```bash
# 移除测试文件
rm server/scripts/test-jwt.ts

# 清理不需要的依赖引用
# 检查并移除 express-session 相关 import
```

### Step 18: 添加 Token 刷新机制

- [ ] 实现前端自动刷新
- [ ] 添加刷新失败处理
- [ ] 测试刷新流程

**添加刷新 API:**

```typescript
// server/route/v2.ts
router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ code: 401, message: "Refresh token required" });
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);
    const newAccessToken = await generateAccessToken({
      userId: payload.userId,
      username: payload.username,
    });
    const newRefreshToken = await generateRefreshToken({
      userId: payload.userId,
      username: payload.username,
    });

    res.json({
      code: 0,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    res.status(401).json({ code: 401, message: "Invalid refresh token" });
  }
});
```

### Step 19: 文档和监控

- [ ] 更新 API 文档
- [ ] 添加错误监控
- [ ] 记录迁移完成状态

---

## 📊 最终验收清单

### ✅ 核心功能验收

- [ ] 用户可以正常登录和注册
- [ ] 所有需要认证的 API 都正常工作
- [ ] 权限控制正确 (管理员/普通用户)
- [ ] 多设备登录支持
- [ ] Token 自动刷新机制工作正常

### ✅ 性能验收

- [ ] 登录响应时间 < 500ms
- [ ] API 请求响应时间无明显增加
- [ ] 内存使用无明显增长
- [ ] 支持当前用户并发量

### ✅ 安全验收

- [ ] Token 过期自动处理
- [ ] 无效 token 正确拒绝
- [ ] 敏感操作权限正确
- [ ] 无明显安全漏洞

### ✅ 代码质量验收

- [ ] 代码清理完成
- [ ] 无冗余依赖
- [ ] 错误处理完善
- [ ] 日志记录清晰

---

## 🚀 部署准备

### 生产环境检查

- [ ] 环境变量配置正确
- [ ] JWT 密钥足够强度
- [ ] 数据库连接正常
- [ ] 前端构建成功

### 部署流程

1. [ ] 停止生产服务
2. [ ] 备份当前数据库
3. [ ] 部署新代码
4. [ ] 更新环境变量
5. [ ] 启动服务
6. [ ] 验证核心功能
7. [ ] 监控错误日志

---

## 📝 施工日志模板

```
日期: ___________
阶段: ___________
完成内容:
- [ ] ___________
- [ ] ___________

遇到的问题:
- ___________

解决方案:
- ___________

下一步计划:
- ___________

风险点:
- ___________
```

---

## 🆘 回滚预案

如果迁移过程中遇到严重问题：

1. **立即回滚步骤:**

   ```bash
   git checkout main
   git reset --hard HEAD
   ```

2. **恢复数据库:**

   ```bash
   # 从备份恢复数据库
   ```

3. **重启服务:**

   ```bash
   cd server && bun run dev
   cd web && bun run dev
   ```

4. **验证功能:**
   - 确认用户可以正常登录
   - 确认所有 API 正常工作

---

这份施工清单设计为渐进式实施，每个步骤都有明确的验收标准，可以随时暂停和回滚。建议按顺序执行，每完成一个阶段就提交代码并测试。
