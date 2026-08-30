# ----------------------------------------------------
# 阶段 1: 依赖安装 (deps)
# ----------------------------------------------------
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# 复制依赖文件（利用 Docker 缓存层）
COPY package.json bun.lock* ./

# 🚨 关键：只安装生产环境依赖！
RUN bun install --production --frozen-lockfile

# ----------------------------------------------------
# 阶段 2: 代码编译 (builder)
# ----------------------------------------------------
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# 安装所有依赖（包括 devDependencies，编译时需要 TypeScript）
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 编译所有 TypeScript 代码到 dist 目录
RUN bun run build

# ----------------------------------------------------
# 阶段 3: 运行时镜像 (runner) - 极致瘦身！
# ----------------------------------------------------
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# 创建非 root 用户（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunuser

# 复制 package.json 和 lockfile（用于重新安装生产依赖）
COPY --from=builder --chown=bunuser:nodejs /app/package.json ./
COPY --from=builder --chown=bunuser:nodejs /app/bun.lock* ./

# 🚨 关键优化：只安装生产依赖（已改用程序化迁移，不需要 drizzle-kit）
RUN bun install --production --frozen-lockfile

# 从 builder 阶段复制编译后的代码和迁移文件
COPY --from=builder --chown=bunuser:nodejs /app/dist ./dist
COPY --from=builder --chown=bunuser:nodejs /app/drizzle ./drizzle

# 验证迁移文件是否存在（构建时检查）
RUN if [ ! -d "./drizzle/migrations" ]; then \
      echo "❌ ERROR: drizzle/migrations directory not found!" && \
      echo "💡 This indicates migrations were not copied correctly during build." && \
      exit 1; \
    fi && \
    if [ ! -f "./drizzle/migrations/meta/_journal.json" ]; then \
      echo "❌ ERROR: Migration metadata file not found!" && \
      echo "💡 This indicates migrations were not copied correctly during build." && \
      exit 1; \
    fi && \
    if [ ! -f "./dist/scripts/backfillHeicBrowserCovers.js" ]; then \
      echo "❌ ERROR: HEIC browser cover backfill CLI not found!" && \
      echo "💡 This indicates the operations CLI was excluded from the runtime image." && \
      exit 1; \
    fi && \
    echo "✅ Migration files verified successfully"

# 🔥 终极清理：删除所有不必要的文件以减小镜像大小
# 注意：避免删除关键依赖包（如 postgres）的必要文件
RUN rm -rf /app/node_modules/.cache /tmp/* /var/cache/apk/* && \
    # 删除测试、文档、示例等目录（排除关键依赖包）
    find /app/node_modules -type d \( \
        -name "test" -o -name "tests" -o -name "__tests__" -o \
        -name "*.test.*" -o -name "*.spec.*" -o \
        -name "docs" -o -name "doc" -o \
        -name "examples" -o -name "example" -o \
        -name "benchmark" -o -name "benchmarks" \
    \) ! -path "*/node_modules/postgres/*" \
      ! -path "*/node_modules/drizzle-orm/*" \
      -exec rm -rf {} + 2>/dev/null || true && \
    # 删除文档、源码映射等（排除关键依赖包）
    find /app/node_modules -type f \( \
        -name "*.md" -o -name "*.map" -o \
        -name "CHANGELOG*" -o -name "LICENSE*" -o -name "README*" \
    \) ! -path "*/node_modules/postgres/*" \
      ! -path "*/node_modules/drizzle-orm/*" \
      -delete 2>/dev/null || true && \
    # 删除 TypeScript 源文件（但保留 .d.ts 类型定义文件，某些包可能需要）
    find /app/node_modules -type f \( \
        -name "*.ts" -o -name "*.tsx" \
    \) ! -name "*.d.ts" \
      ! -path "*/node_modules/@types/*" \
      ! -path "*/node_modules/postgres/*" \
      ! -path "*/node_modules/drizzle-orm/*" \
      -delete 2>/dev/null || true && \
    # 删除 package.json 以外的 JSON 配置文件（排除关键依赖包）
    find /app/node_modules -type f -name "*.json" ! -name "package.json" ! -path "*/node_modules/@types/*" \
      ! -path "*/node_modules/postgres/*" \
      ! -path "*/node_modules/drizzle-orm/*" \
      -delete 2>/dev/null || true

# 设置环境变量，提升性能
ARG ROTE_RELEASE_VERSION=unknown
ENV NODE_ENV=production \
    ROTE_RELEASE_VERSION=${ROTE_RELEASE_VERSION}

# 切换到非 root 用户
USER bunuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/v2/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# 启动命令：指向编译后的入口文件
CMD ["bun", "run", "dist/server.js"]
