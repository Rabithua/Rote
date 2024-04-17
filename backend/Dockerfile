# 使用更小的基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /root/rote_node

# 复制项目文件
COPY ./ .

# 暴露容器的 3000 端口
EXPOSE 3000

# 在容器启动时安装依赖、编译 Prisma 客户端并启动应用
CMD ["sh", "-c", "npm install --production && npx prisma generate && npm start"]