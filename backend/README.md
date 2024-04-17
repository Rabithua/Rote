# Rote_node 后端部分

node v18.16.1
npm v9.5.1

## 后端创建，数据库以及初始化

```
npm run mongoInit
```

### 将 schema.prisma 应用到数据库

```
npx prisma db push
```

### 生成 prisma 客户端

```
npx prisma generate

```

## 其他操作

### 更新 schema.prisma 后如何操作

```
npx prisma db push

npx prisma generate
```

### 构建镜像

```
docker build -t rotebackend:latest .
```
> 多平台镜像，prisma不支持arm/v7
```
docker buildx build --platform linux/amd64,linux/arm64 -t rabithua/rotebackend:latest --push .
```

## 注意事项

- 后端容器生成后会在本地拉取npm包，需要几分钟时间，这段时间后端将不可用