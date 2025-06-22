FROM node:lts-alpine
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 3000
RUN chown -R node /usr/src/app
USER node
CMD ["sh", "-c", "npx prisma db push && npm start"]
