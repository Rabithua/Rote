# 阶段 1: 构建阶段 (Builder)
FROM node:22.12-alpine AS builder

# 安装 Bun（用于快速安装依赖和构建）
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# 设置 bun 配置（禁用缓存以减小镜像）
ENV BUN_INSTALL_CACHE=0
ENV BUN_CONFIG_REGISTRY=https://registry.npmjs.org

# 复制依赖文件并安装（利用 Docker 缓存层）
COPY package.json bun.lock* ./
RUN bun install --force

# 复制源代码并构建
COPY . .

# 构建前端（VITE_API_BASE 通过 ARG 传入，构建时注入）
ARG VITE_API_BASE=http://localhost:3000
ENV VITE_API_BASE=${VITE_API_BASE}
RUN bun run build

# 阶段 2: 最终镜像 (Final)
# 使用 Nginx Alpine，极度精简的 Web Server，基础镜像 ~20MB
FROM nginx:alpine

# 从构建阶段复制 Vite 的 /dist 目录产物到 Nginx 的服务目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 创建启动脚本（用于运行时注入 VITE_API_BASE 和配置 Nginx）
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

# 配置 Nginx（SPA 路由支持、静态资源缓存、Gzip 压缩）
cat > /etc/nginx/conf.d/default.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
}
NGINX_EOF

# 启动 Nginx
exec nginx -g "daemon off;"
EOFSCRIPT

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
