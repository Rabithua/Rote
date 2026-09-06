# 阶段 1: 依赖安装阶段
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# 复制依赖文件（利用 Docker 缓存层）
COPY package.json bun.lock* ./
# 安装依赖（不使用 --force，使用 --frozen-lockfile 确保一致性）
RUN bun install --frozen-lockfile

# 阶段 2: 构建阶段
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建前端（VITE_API_BASE 通过 ARG 传入，构建时注入）
ARG VITE_API_BASE=http://localhost:3000
ENV VITE_API_BASE=${VITE_API_BASE}

# 构建项目
RUN bun run build

# 清理构建缓存和不必要的文件
RUN rm -rf node_modules && \
    rm -rf .vite && \
    find dist -type f -name "*.map" -delete || true

# 阶段 3: 最终镜像 (Final)
# 使用 Nginx Alpine，极度精简的 Web Server，基础镜像 ~20MB
FROM nginx:alpine

# 从构建阶段复制 Vite 的 /dist 目录产物到 Nginx 的服务目录
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 清理 Nginx 默认文件以减小镜像
RUN rm -rf /usr/share/nginx/html/*.md && \
    rm -rf /etc/nginx/conf.d/default.conf.bak || true

# 创建启动脚本（用于运行时注入 VITE_API_BASE）
RUN cat > /docker-entrypoint.sh << 'EOFSCRIPT' && chmod +x /docker-entrypoint.sh
#!/bin/sh
set -e

# 运行时注入 VITE_API_BASE 到 HTML（如果需要）
if [ -n "$VITE_API_BASE" ] && [ -f /usr/share/nginx/html/index.html ]; then
  ESCAPED_API_BASE=$(echo "${VITE_API_BASE}" | sed 's/\\/\\\\/g; s/&/\\&/g' 2>/dev/null || echo "${VITE_API_BASE}")
  JSON_ESCAPED_API_BASE=$(echo "${VITE_API_BASE}" | sed 's/\\/\\\\/g; s/"/\\"/g' 2>/dev/null || echo "${VITE_API_BASE}")
  
  if grep -q "__VITE_API_BASE_PLACEHOLDER__" /usr/share/nginx/html/index.html 2>/dev/null; then
    sed -i "s|__VITE_API_BASE_PLACEHOLDER__|${ESCAPED_API_BASE}|g" /usr/share/nginx/html/index.html 2>/dev/null || true
    echo "✓ 已注入 VITE_API_BASE: ${VITE_API_BASE}"
  elif ! grep -q "__ROTE_CONFIG__" /usr/share/nginx/html/index.html 2>/dev/null; then
    CONFIG_SCRIPT="<script>window.__ROTE_CONFIG__=window.__ROTE_CONFIG__||{};window.__ROTE_CONFIG__.VITE_API_BASE=\"${JSON_ESCAPED_API_BASE}\";</script>"
    sed -i "s|</head>|${CONFIG_SCRIPT}</head>|" /usr/share/nginx/html/index.html 2>/dev/null || true
    echo "✓ 已插入配置脚本，VITE_API_BASE: ${VITE_API_BASE}"
  fi
fi

# 启动 Nginx
exec nginx -g "daemon off;"
EOFSCRIPT

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
