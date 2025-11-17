FROM node:lts-alpine

ENV NODE_ENV=production

# 安装运行时必需的包和工具（合并 RUN 减少层数）
RUN apk add --no-cache openssl su-exec && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /usr/src/app

# 复制依赖文件和源代码
COPY package.json package-lock.json* ./
COPY . .

# 创建启动脚本和入口脚本（合并 RUN 减少层数）
RUN cat > /usr/src/app/docker-start.sh << 'EOFSCRIPT' && chmod +x /usr/src/app/docker-start.sh && \
    cat > /usr/src/app/docker-entrypoint.sh << 'EOFENTRY' && chmod +x /usr/src/app/docker-entrypoint.sh
#!/bin/sh
set -e

# 检查 node_modules 是否存在且 package.json 未变更
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "📦 Installing production dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci --omit=dev || npm install --omit=dev
  else
    npm install --omit=dev
  fi
  echo "📦 Installing build tools..."
  npm install --save-dev ts-node prisma typescript @types/node || true
  npm cache clean --force
  touch node_modules/.package-lock.json
else
  echo "✅ Using cached dependencies"
  if [ ! -d "node_modules/ts-node" ]; then
    echo "📦 Installing build tools..."
    npm install --save-dev ts-node prisma typescript @types/node || true
  fi
fi

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "🔧 Pushing database schema..."
npx prisma db push || true

echo "🚀 Starting server..."
exec npm start
EOFSCRIPT
#!/bin/sh
set -e

# 如果 node_modules 目录存在（volume 挂载），修复权限
if [ -d "node_modules" ]; then
  echo "🔧 Fixing node_modules permissions..."
  chown -R nodejs:nodejs node_modules 2>/dev/null || true
fi

# 切换到 nodejs 用户并执行启动脚本
exec su-exec nodejs /usr/src/app/docker-start.sh
EOFENTRY

# 设置文件权限（以 root 身份）
RUN chown -R nodejs:nodejs /usr/src/app

# 保持 root 用户，在 entrypoint 中切换
EXPOSE 3000

ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
