# prisma_node_practice

prisma 的一个小练习

# 后端创建，数据库以及初始化

```
npm run mongoInit
```

将 schema.prisma 应用到数据库
npx prisma db push

生成 prisma 客户端
npx prisma generate

```

## 更新`schema.prisma`后如何操作

```

npx prisma db push

npx prisma generate

```

## 进入 docker 容器

```

docker exec -it RoteMongo1 bash

可以使用以下命令

mongosh

mongo
