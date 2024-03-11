# Rote_node 后端部分
node v18.16.1
npm v9.5.1

## 后端创建，数据库以及初始化

```
npm run mongoInit
```

### 将schema.prisma应用到数据库

```
npx prisma db push
```

### 生成prisma客户端

```
npx prisma generate

```

## 其他操作

### 更新 schema.prisma 后如何操作

```
npx prisma db push

npx prisma generate
```