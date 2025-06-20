# 基于 oven/bun 镜像直接运行 Vite 前端
FROM oven/bun:1.1.38-alpine

WORKDIR /app

# 复制依赖文件并安装依赖
COPY package.json bun.lock ./
RUN bun install

# 复制全部前端代码
COPY . .

# 构建前端静态文件
RUN bun run build

# 直接用 Vite 预览模式启动（适合开发/预览环境）
EXPOSE 3001
CMD ["bun", "run", "preview"]
