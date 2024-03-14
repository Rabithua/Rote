# 使用 node 官方镜像作为基础镜像
FROM node:18

# 设置工作目录
WORKDIR /root/rote_node

# 复制 package.json 和 package-lock.json (如果存在)
COPY ./package*.json ./

# 安装项目依赖
RUN npm install

# 复制项目文件
COPY ./ .

# 编译 Prisma 客户端
RUN npx prisma generate

# 初始化数据库
# RUN npx prisma db push

# 暴露容器的 3000 端口
EXPOSE 3000

# 运行 npm start 启动应用
CMD ["npm", "start"]
