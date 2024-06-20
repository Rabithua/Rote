# 1. For build React app
FROM node:18-alpine as build

WORKDIR /root/rote_react

COPY ./ .

EXPOSE 3000

RUN npm install -g serve

CMD ["sh", "-c", "npm install --omit=dev && npm run buildwithsitemap && serve -s build"]