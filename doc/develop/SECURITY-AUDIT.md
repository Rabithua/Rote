# 后端安全漏洞分析报告

## 执行摘要

本报告对 Rote 项目后端代码进行了全面的安全审计，识别了多个潜在的安全漏洞和风险点。总体而言，项目使用了 Drizzle ORM（有效防止 SQL 注入）、JWT 认证、密码哈希等安全措施，但仍存在一些需要改进的安全问题。

## 严重程度分类

- 🔴 **高危 (Critical)**: 可能导致严重安全问题的漏洞
- 🟠 **中危 (High)**: 可能导致中等安全风险的漏洞
- 🟡 **低危 (Medium)**: 可能导致轻微安全风险的漏洞
- 🔵 **信息 (Info)**: 安全最佳实践建议

---

## 1. 高危漏洞

### 1.1 CORS 配置过于宽松 (可以忽略)

**位置**: `server/server.ts:66-87`

**问题描述**:
当 `allowedOrigins` 为 `null` 时，CORS 配置允许所有来源的跨域请求，这可能导致：

- CSRF 攻击风险
- 敏感数据泄露
- 未授权访问

**代码片段**:

```66:87:server/server.ts
app.use(
  cors({
    origin: (origin, callback) => {
      // 允许没有 origin 的请求（如移动应用、Postman 等）
      if (!origin) {
        return callback(null, true);
      }
      // 如果没有设置 allowedOrigins，允许所有跨域请求
      if (!allowedOrigins) {
        return callback(null, true);
      }
      // 如果设置了 allowedOrigins，检查 origin 是否在允许列表中
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // 拒绝不在允许列表中的 origin
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
```

**修复建议**:

1. 默认情况下应该拒绝所有跨域请求，除非明确配置了允许的来源
2. 在生产环境中，必须设置 `allowedOrigins`
3. 考虑添加更严格的 CORS 策略，例如限制特定的 HTTP 方法

**修复示例**:

```typescript
// 如果没有配置 allowedOrigins，默认拒绝所有跨域请求
if (!allowedOrigins || allowedOrigins.length === 0) {
  // 生产环境应该拒绝，开发环境可以允许
  if (process.env.NODE_ENV === "production") {
    return callback(new Error("CORS not configured for production"));
  }
}
```

---

### 1.2 文件上传缺少文件类型验证 （已完成修复）

**位置**: `server/route/v2/attachment.ts:25-78`

**问题描述**:
文件上传功能仅检查文件字段名是否为 `images`，但没有验证：

- 实际文件类型（MIME type）
- 文件扩展名
- 文件内容（magic bytes）

攻击者可能上传恶意文件（如 PHP、JavaScript、可执行文件等）。

**代码片段**:

```43:48:server/route/v2/attachment.ts
const [fields, files] = await form.parse(req);
if (!files.images) {
  throw new Error('No images uploaded');
}

const imageFiles = Array.isArray(files.images) ? files.images : [files.images];
```

**修复建议**:

1. 验证文件 MIME type，只允许图片类型
2. 验证文件扩展名
3. 使用文件内容检测（magic bytes）验证真实文件类型
4. 对上传的文件进行病毒扫描（可选）

**修复示例**:

```typescript
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const imageFiles = Array.isArray(files.images) ? files.images : [files.images];

for (const file of imageFiles) {
  // 验证 MIME type
  if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`Invalid file type: ${file.mimetype}`);
  }

  // 验证扩展名
  const ext = path.extname(file.originalFilename || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Invalid file extension: ${ext}`);
  }

  // 验证文件内容（使用 sharp 或 file-type 库）
  // ...
}
```

---

### 1.3 预签名 URL 缺少文件类型和大小限制 （已完成修复）

**位置**: `server/route/v2/attachment.ts:150-213`

**问题描述**:
预签名 URL 生成接口接受客户端提供的 `contentType`，没有严格验证，可能导致：

- 上传非图片文件
- 绕过文件类型检查
- 存储恶意文件

**代码片段**:

```156:179:server/route/v2/attachment.ts
const { files } = req.body as {
  files: Array<{ filename?: string; contentType?: string; size?: number }>;
};

if (!files || !Array.isArray(files) || files.length === 0) {
  throw new Error('No files to presign');
}

const getExt = (filename?: string, contentType?: string) => {
  if (filename && filename.includes('.')) return `.${filename.split('.').pop()}`;
  if (!contentType) return '';
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  };
  return map[contentType] || '';
};
```

**修复建议**:

1. 严格验证 `contentType`，只允许预定义的图片类型
2. 验证文件大小限制
3. 限制预签名 URL 的数量

**修复示例**:

```typescript
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 9;

if (files.length > MAX_FILES) {
  throw new Error(`Maximum ${MAX_FILES} files allowed`);
}

for (const f of files) {
  if (f.contentType && !ALLOWED_CONTENT_TYPES.includes(f.contentType)) {
    throw new Error(`Invalid content type: ${f.contentType}`);
  }
  if (f.size && f.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE} bytes`);
  }
}
```

---

### 1.4 敏感信息泄露 - 错误信息过于详细 （可以忽略）

**位置**: `server/utils/handlers.ts:3-70`

**问题描述**:
错误处理函数在开发环境下会打印完整的错误堆栈，可能泄露：

- 内部文件路径
- 数据库结构信息
- 系统配置信息

**代码片段**:

```3:8:server/utils/handlers.ts
export const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('API Error:', err.message);
  // 只在开发环境下打印完整的错误堆栈
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', err);
  }
```

**修复建议**:

1. 确保生产环境不输出详细错误信息
2. 对错误信息进行清理，移除敏感路径
3. 使用错误日志系统，而不是直接 console.error

---

### 1.5 密码长度限制过短 （已完成修复）

**位置**: `server/utils/zod.ts:14-17, 30-33`

**问题描述**:
密码最大长度限制为 30 个字符，这可能不够安全。现代密码策略建议：

- 最小长度至少 6 个字符（已放宽要求，提升用户体验）
- 最大长度应该更长（如 128 个字符）
- 不再强制要求大小写字母和数字的组合（已放宽要求）

**代码片段**:

```14:17:server/utils/zod.ts
password: z
  .string()
  .min(6, '密码长度至少为 6 个字符')
  .max(128, '密码长度不能超过 128 个字符'),
```

**当前实现**:

```typescript
password: z
  .string()
  .min(6, '密码长度至少为 6 个字符')
  .max(128, '密码长度不能超过 128 个字符'),
```

**说明**: 为了提升用户体验，密码策略已放宽为仅要求最小长度 6 个字符，不再强制要求大小写字母和数字的组合。

---

## 2. 中危漏洞

### 2.1 限流器使用内存存储 （可以忽略）

**位置**: `server/middleware/limiter.ts:4-4`

**问题描述**:
限流器使用 `RateLimiterMemory`，这意味着：

- 服务器重启后限流计数会重置
- 多实例部署时无法共享限流状态
- 可能导致分布式拒绝服务攻击

**代码片段**:

```4:4:server/middleware/limiter.ts
const limiter = new RateLimiterMemory({
  points: 100, // Maximum number of requests allowed within the duration
  duration: 1, // Duration in seconds
});
```

**修复建议**:

1. 使用 Redis 等持久化存储实现分布式限流
2. 针对不同端点设置不同的限流策略
3. 实现更细粒度的限流（如按 IP、用户 ID、端点等）

---

### 2.2 缺少请求大小限制 （已完成修复）

**位置**: `server/server.ts:38-39`

**问题描述**:
`body-parser` 没有明确设置请求体大小限制，可能导致：

- 内存耗尽攻击
- 拒绝服务攻击

**代码片段**:

```38:39:server/server.ts
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
```

**修复建议**:

```typescript
app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: "10mb", // 设置合理的限制
  })
);
app.use(
  bodyParser.json({
    limit: "10mb", // 设置合理的限制
  })
);
```

---

### 2.3 批量操作缺少数量限制 （已完成修复）

**位置**: `server/route/v2/attachment.ts`

**问题描述**:
虽然批量获取笔记接口有 100 条的限制，但其他批量操作（如批量删除附件、更新附件排序、完成回调）缺少限制。

**修复内容**:

已在 `server/route/v2/attachment.ts` 中添加 `MAX_BATCH_SIZE = 100` 常量，并在以下接口中添加了数量限制：

1. **批量删除附件** (`DELETE /`): 限制最多 100 个附件
2. **更新附件排序** (`PUT /sort`): 限制最多 100 个附件
3. **完成回调接口** (`POST /finalize`): 限制最多 100 个附件

**修复后的代码片段**:

```126:149:server/route/v2/attachment.ts
// 批量删除附件
attachmentsRouter.delete(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      throw new Error('No attachments to delete');
    }

    // 限制批量删除的数量，防止滥用
    if (ids.length > MAX_BATCH_SIZE) {
      throw new Error(`最多允许一次删除 ${MAX_BATCH_SIZE} 个附件`);
    }

    const data = await deleteAttachments(
      ids.map((id: string) => ({ id })),
      user.id
    );
    res.status(200).json(createResponse(data));
  })
);
```

---

### 2.4 缺少 CSRF 保护 （暂时忽略）

**问题描述**:
虽然使用了 JWT 认证，但没有实现 CSRF 保护机制。对于使用 cookie 的会话管理，CSRF 保护是必需的。

**修复建议**:

1. 使用 `csurf` 中间件或实现自定义 CSRF token 验证
2. 对于 API 调用，确保使用自定义 header（如 `X-Requested-With`）
3. 实施 SameSite cookie 属性（如果使用 cookie）

---

### 2.5 日志中可能泄露敏感信息（可以忽略）

**位置**: 多个文件中的 `console.log` 和 `console.error`

**问题描述**:
代码中存在大量日志输出，可能包含：

- 用户信息
- 配置信息
- 错误堆栈

**修复建议**:

1. 使用专业的日志库（如 winston、pino）
2. 实现日志级别控制
3. 在生产环境中过滤敏感信息
4. 确保日志不会输出到控制台（生产环境）

---

## 3. 低危漏洞

### 3.1 用户名验证可能不够严格（可以忽略）

**位置**: `server/utils/zod.ts:5-16`

**问题描述**:
用户名验证允许下划线和连字符，但可能需要更严格的规则以防止：

- 混淆攻击（如 `admin` vs `admіn`，使用相似字符）
- SQL 注入尝试（虽然使用 Drizzle ORM，但仍需注意）

**代码片段**:

```5:16:server/utils/zod.ts
username: z
  .string()
  .min(1, "Username cannot be empty")
  .max(20, "Username cannot exceed 20 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Username can only contain letters, numbers, underscore and hyphen"
  )
  .refine((value) => !safeRoutes.includes(value), {
    message: "Username conflicts with routes, please choose another one",
  }),
```

**修复建议**:

- 考虑禁止以数字开头
- 禁止连续的特殊字符
- 考虑 Unicode 规范化

---

### 3.2 缺少输入长度限制 ✅ 已修复

**位置**: 多个路由处理函数

**问题描述**:
某些输入字段（如笔记内容、标题等）可能缺少长度限制，可能导致：

- 存储空间耗尽
- 性能问题
- 拒绝服务攻击

**修复状态**: ✅ 已修复

**修复内容**:
已在 `server/utils/zod.ts` 中添加了以下验证 schema，并在相应路由中应用：

1. **笔记相关验证** (`NoteCreateZod`, `NoteUpdateZod`):

   - `title`: 最大 200 个字符
   - `content`: 最大 1,000,000 个字符（约 1MB 文本）
   - `tags`: 每个标签最大 50 个字符，最多 20 个标签

2. **搜索关键词验证** (`SearchKeywordZod`):

   - `keyword`: 必须是非空字符串。笔记搜索为支持完整导入标签名，已移除原有的 200 字符限制；查询仍使用参数化 SQL。

3. **反应相关验证** (`ReactionCreateZod`):

   - `type`: 最大 50 个字符
   - `visitorId`: 最大 200 个字符

4. **附件相关验证** (`AttachmentPresignZod`):
   - `filename`: 最大 255 个字符

**修复文件**:

- `server/utils/zod.ts`: 添加验证 schema
- `server/route/v2/note.ts`: 应用笔记和搜索验证
- `server/route/v2/reaction.ts`: 应用反应验证
- `server/route/v2/attachment.ts`: 应用附件验证

---

### 3.3 缺少速率限制的差异化策略（可以忽略）

**位置**: `server/middleware/limiter.ts`

**问题描述**:
所有端点使用相同的限流策略（100 请求/秒），但不同端点应该有不同的限制：

- 登录接口应该更严格
- 文件上传应该更严格
- 只读接口可以更宽松

**修复建议**:
为不同端点实现不同的限流策略。

---

### 3.4 缺少安全响应头（可以忽略）

**问题描述**:
没有设置重要的安全响应头，如：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

**修复建议**:
使用 `helmet` 中间件或手动设置这些响应头。

---

## 4. 信息类建议

### 4.1 依赖包安全

**建议**:

1. 定期运行 `bun audit` 检查依赖漏洞（Bun 内置安全审计功能，推荐使用）
2. 使用 `bun update` 更新所有依赖到最新兼容版本，或使用 `bun update --latest` 更新到最新版本（包括破坏性更新）
3. 考虑使用 Snyk 或 Dependabot 进行持续监控和自动更新
4. 定期检查依赖包的更新日志和安全公告

**注意**: 由于项目使用 `bun.lock` 作为锁文件，`npm audit` 无法直接使用（需要 `package-lock.json`）。建议统一使用 `bun audit` 进行安全审计。

### 4.2 环境变量管理

**建议**:

1. 确保敏感信息（如数据库密码、JWT 密钥）存储在环境变量中
2. 使用 `.env.example` 文件作为模板
3. 确保 `.env` 文件在 `.gitignore` 中

### 4.3 数据库连接安全

**建议**:

1. 使用 SSL/TLS 连接数据库
2. 实施数据库连接池限制
3. 定期备份数据库

### 4.4 API 版本控制

**建议**:

1. 当前使用 `/v2/api` 前缀，这是好的实践
2. 考虑实现 API 废弃策略
3. 文档化 API 变更

### 4.5 监控和告警

**建议**:

1. 实施应用性能监控（APM）
2. 设置安全事件告警
3. 记录所有认证失败尝试
4. 监控异常请求模式

---

## 5. 安全最佳实践总结

### 已实施的安全措施 ✅

1. ✅ 使用 Drizzle ORM（防止 SQL 注入）
2. ✅ JWT 认证机制
3. ✅ 密码哈希（使用 pbkdf2）
4. ✅ 输入验证（使用 Zod）
5. ✅ UUID 格式验证
6. ✅ 角色和权限控制
7. ✅ 文件大小限制
8. ✅ 限流机制（虽然使用内存存储）

### 需要改进的方面 ⚠️

1. ⚠️ CORS 配置过于宽松
2. ⚠️ 文件类型验证不足
3. ⚠️ 缺少 CSRF 保护
4. ⚠️ 错误信息可能泄露敏感信息
5. ⚠️ 缺少安全响应头
6. ⚠️ 限流器使用内存存储

---

## 6. 修复优先级建议

### 立即修复（P0）

1. CORS 配置安全加固
2. 文件上传类型验证
3. 预签名 URL 验证

### 短期修复（P1）

1. 实施 CSRF 保护
2. 添加安全响应头
3. 改进错误处理
4. 密码策略加强

### 中期改进（P2）

1. 使用 Redis 限流器
2. 实施日志系统
3. 添加监控和告警
4. 依赖包安全审计

---

## 7. 测试建议

1. **渗透测试**: 进行专业的渗透测试
2. **代码审计**: 定期进行代码安全审计
3. **依赖扫描**: 使用自动化工具扫描依赖漏洞
4. **安全测试**: 实施安全测试流程

---

## 附录

### 相关文件清单

- `server/server.ts` - 主服务器配置
- `server/middleware/jwtAuth.ts` - JWT 认证中间件
- `server/middleware/limiter.ts` - 限流中间件
- `server/route/v2/attachment.ts` - 文件上传路由
- `server/route/v2/auth.ts` - 认证路由
- `server/utils/zod.ts` - 输入验证
- `server/utils/handlers.ts` - 错误处理
- `server/utils/r2.ts` - 文件存储处理

### 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**报告生成时间**: 2025 年 11 月 15 日
**审计范围**: 后端代码库 (`server/` 目录)
**审计方法**: 静态代码分析 + 手动代码审查
