# 1. For build React app
FROM node:18-alpine as build

WORKDIR /app

COPY ./ .

EXPOSE 3000

RUN npm install -g serve

RUN npm install --omit=dev

CMD ["sh", "-c", "npm run buildwithsitemap && serve -s build"]