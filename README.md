# prisma_node_practice

prisma 的一个小练习

# 后端创建，数据库以及初始化

```
npm run mongoInit
```

进入 docker 容器

```
docker exec -it RoteMongo1  bash

mongosh

#创建数据库关系
rs.initiate({_id: 'myReplicaSet', members: [{_id: 0, host: 'RoteMongo1'}, {_id: 1, host: 'RoteMongo2'}]})

# 连按两次ctrl + C退出mongosh

mongo 

#创建Rote需要用到的数据库
use Rote

db.createCollection('Rote')

#Ctrl + C 退出mongo

#退出容器
exit

#将schema.prisma应用到数据库
npx prisma db push

#生成prisma客户端
npx prisma generate

```

#更新`schema.prisma`后如何操作

```
npx prisma db push

npx prisma generate
```