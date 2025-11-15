# 使用 Node.js 22.12+ 镜像，然后安装 Bun
FROM node:22.12-alpine AS builder

# 安装必要的工具（curl 和 bash）
RUN apk add --no-cache curl bash

# 安装 Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# 设置 bun 使用 npm 官方源，避免网络问题
ENV BUN_INSTALL_CACHE=0
ENV BUN_CONFIG_REGISTRY=https://registry.npmjs.org

# 复制依赖文件并安装依赖（兼容 bun.lock 或 bun.lockb）
COPY package.json bun.lock* ./
# 清理并重新安装依赖，确保版本一致
RUN rm -rf node_modules && bun install --force

# 复制全部前端代码
COPY . .

# 构建前端静态文件
# VITE_API_BASE 在构建时通过 ARG 传入并注入到代码中
ARG VITE_API_BASE=http://localhost:3000
ENV VITE_API_BASE=${VITE_API_BASE}
RUN bun run build

# 生产阶段：使用轻量级镜像运行预览服务器
FROM node:22.12-alpine

# 安装必要的工具（curl 和 bash）
RUN apk add --no-cache curl bash

# 安装 Bun（用于运行预览命令）
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/vite.config.ts ./
# 安装所有依赖（vite preview 需要 vite，它在 devDependencies 中）
RUN bun install

# 从构建上下文复制启动脚本并设置执行权限
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 使用启动脚本作为入口点，在启动时注入环境变量
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "preview"]
