FROM node:lts-alpine
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent
COPY . .
RUN npx prisma generate
EXPOSE 3000

# 💡 修正点：以 root 身份安装 netcat，供后续动态等待使用
RUN apk add --no-cache netcat-openbsd 

RUN chown -R node /usr/src
USER node
CMD ["sh", "-c", "npx prisma db push && npm start"]