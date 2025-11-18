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

# 🚨 关键优化：在 runner 阶段重新安装生产依赖
# 这样可以确保完全没有 devDependencies，并且只安装运行时需要的包
RUN bun install --production --frozen-lockfile

# 从 builder 阶段复制编译后的代码
COPY --from=builder --chown=bunuser:nodejs /app/dist ./dist

# 🔥 终极清理：删除所有不必要的文件
RUN rm -rf /app/node_modules/.cache && \
    rm -rf /tmp/* && \
    rm -rf /var/cache/apk/* && \
    # 🚨 强制删除 TypeScript 及其相关包（生产环境不需要）
    rm -rf /app/node_modules/typescript && \
    rm -rf /app/node_modules/@typescript-eslint && \
    rm -rf /app/node_modules/typescript-eslint && \
    # 删除测试相关目录
    find /app/node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "*.test.*" -o -name "*.spec.*" -o -name "docs" -o -name "doc" -o -name "examples" -o -name "example" -o -name "benchmark" -o -name "benchmarks" \) -exec rm -rf {} + 2>/dev/null || true && \
    # 删除文档和配置文件
    find /app/node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "CHANGELOG*" -o -name "LICENSE*" -o -name "README*" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" ! -name "package.json" \) ! -path "*/node_modules/@types/*" -delete 2>/dev/null || true && \
    # 删除类型定义文件（运行时不需要）
    find /app/node_modules -type f -name "*.d.ts" ! -path "*/node_modules/@types/*" -delete 2>/dev/null || true && \
    # 删除源码文件（只保留编译后的代码）
    find /app/node_modules -type f \( -name "*.js" ! -name "*.min.js" \) -path "*/src/*" -delete 2>/dev/null || true

# 设置环境变量，提升性能
ENV NODE_ENV=production

# 切换到非 root 用户
USER bunuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/v2/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# 启动命令：指向编译后的入口文件
CMD ["bun", "run", "dist/server.js"]
