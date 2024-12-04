# Rote_node 后端部分

node v18.16.1
npm v9.5.1

## 后端创建，数据库以及初始化

```
npm run mongoInit
```

## 其他操作

### 更新 schema.prisma 后如何操作

```
npm run prisma-update
```

### 构建镜像

> 本地构建

```
docker build -t rotebackend:latest .
```

> 多平台镜像，prisma 不支持 arm/v7，构建并上传 docker，注意替换 username

```
docker buildx build --platform linux/amd64,linux/arm64 -t rabithua/rotebackend:latest --push .

docker buildx build --platform linux/amd64,linux/arm64 \
  -t rabithua/rotebackend:latest \
  -t rabithua/rotebackend:0.2.2 \
  --push .
```

## 注意事项

- 后端容器生成后会在本地拉取 npm 包，需要几分钟时间，这段时间后端将不可用
