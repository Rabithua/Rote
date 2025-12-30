# Garage 快速启动指南

本指南介绍如何快速启动 Garage 服务并配置为 Rote 的存储后端。

> **官方文档**：本指南基于 Garage 官方文档编写，更多详细信息请参考 [Garage 官方快速启动指南](https://garagehq.deuxfleurs.fr/documentation/quick-start/) 和 [完整文档](https://garagehq.deuxfleurs.fr/)。

## 0. 生成配置文件（首次使用）

首次使用需要生成 `garage.toml` 配置文件。建议使用官方方法生成包含随机密钥的安全配置：

```bash
cd doc/storage/garage

# 生成配置文件（包含随机密钥）
cat > garage.toml <<EOF
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "$(openssl rand -hex 32)"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"

[k2v_api]
api_bind_addr = "[::]:3904"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "$(openssl rand -base64 32)"
metrics_token = "$(openssl rand -base64 32)"
EOF
```

**重要提示**：

- 此命令会生成包含随机密钥的安全配置文件
- `rpc_secret`、`admin_token` 和 `metrics_token` 都是随机生成的，确保安全性
- 配置文件包含敏感信息，已通过 `.gitignore` 忽略，不会提交到版本控制
- **路径说明**：官方快速启动指南使用 `/tmp/meta` 和 `/tmp/data` 用于快速测试，本配置使用 `/var/lib/garage/meta` 和 `/var/lib/garage/data` 用于生产环境持久化存储，与 Docker Compose 配置保持一致

## 1. 启动 Garage 服务

### 启动容器

```bash
cd doc/storage/garage
docker compose up -d
```

### 检查服务状态

```bash
docker logs garage
```

## 2. 初始化集群布局

首次使用需要初始化集群布局。

### 获取节点 ID

```bash
docker exec garage /garage node id
```

输出示例：

```
ff41e507c3d46da866e889e464c994d9fc37617975fea2704e21ba51324e6a84@127.0.0.1:3901
```

**注意**：节点 ID 包含两部分：

- Hash 部分：`ff41e507c3d46da866e889e464c994d9fc37617975fea2704e21ba51324e6a84`
- 地址部分：`@127.0.0.1:3901`

### 分配节点并应用布局

```bash
# 推荐方法：只使用节点 ID 的 Hash 部分（去掉 @127.0.0.1:3901）
docker exec garage /garage layout assign -z dc1 -c 10G ff41e507c3d46da866e889e464c994d9fc37617975fea2704e21ba51324e6a84

# 应用布局
docker exec garage /garage layout apply --version 1

# 验证布局
docker exec garage /garage layout show
```

**注意**：`layout assign` 命令只需要节点 ID 的 Hash 部分（64 字符的十六进制字符串），不需要包含地址部分（`@127.0.0.1:3901`）。

**如果遇到 "0 nodes match" 错误**：

1. 确保只使用节点 ID 的 Hash 部分（64 字符的十六进制字符串），不要包含地址部分（`@127.0.0.1:3901`）

2. 先查看当前布局状态：

   ```bash
   docker exec garage /garage layout show
   ```

3. 确保 Garage 服务已完全启动，等待几秒后重试

## 3. 创建访问密钥

```bash
docker exec garage /garage key create rote-key
```

**重要**：请保存输出的 Key ID 和 Secret Key，后续配置需要用到。

## 4. 创建存储桶

```bash
docker exec garage /garage bucket create rote
```

## 5. 配置存储桶权限

### 授予密钥读写权限

```bash
docker exec garage /garage bucket allow --read --write rote --key <Key ID>
```

### 授予 Owner 权限（用于配置 CORS）

```bash
docker exec garage /garage bucket allow --owner rote --key <Key ID>
```

## 6. 配置 CORS（跨域资源共享）

`cors-config.json` 文件已存在于 garage 目录，包含以下配置：

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3001"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": [
        "ETag",
        "x-amz-server-side-encryption",
        "x-amz-request-id",
        "x-amz-id-2"
      ],
      "MaxAgeSeconds": 3000
    },
    {
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": [
        "ETag",
        "x-amz-server-side-encryption",
        "x-amz-request-id",
        "x-amz-id-2"
      ],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

**注意**：

- 每个 origin 必须配置为独立的 CORS 规则
- 如果前端运行在不同端口，需要添加对应的 origin
- 实际配置文件已包含 `localhost:3000` 和 `localhost:3001` 两个 origin

### 应用 CORS 配置

```bash
docker run --rm \
  -v $(pwd)/cors-config.json:/tmp/cors-config.json \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3api put-bucket-cors \
  --bucket rote \
  --cors-configuration file:///tmp/cors-config.json \
  --endpoint-url http://host.docker.internal:3900 \
  --region garage
```

## 7. 启用 Web 访问（网站托管）

Garage 的 Web 托管功能支持匿名访问，无需配置 bucket policy。

### 启用网站托管

```bash
docker exec garage /garage bucket website --allow rote
```

启用后，即可通过 Web 托管端口（3902）匿名访问存储桶中的资源。

## 8. 访问 Web 资源

启用网站托管后，可以通过 Web 托管端口（3902）匿名访问存储桶中的资源。

### 访问格式

根据 `garage.toml` 配置，Web 托管端口为 3902，访问格式：

```
http://<bucket-name>.web.garage.localhost:3902/<object-key>
```

**示例**（需要先上传文件到存储桶）：

```
http://rote.web.garage.localhost:3902/example.txt
http://rote.web.garage.localhost:3902/path/to/image.jpg
http://rote.web.garage.localhost:3902/users/xxx/uploads/file.png
```

### 配置 hosts 文件（可选）

如果需要使用域名访问，在 `/etc/hosts` 添加：

```
127.0.0.1 rote.web.garage.localhost
```

### 测试访问

上传文件后，可以使用以下方式测试访问：

```bash
# 使用 curl 测试（替换为实际的文件路径）
curl -H "Host: rote.web.garage.localhost" http://localhost:3902/example.txt

# 或在浏览器中直接访问
# http://rote.web.garage.localhost:3902/example.txt
```

**注意**：访问文件前需要先通过 S3 API 上传文件到存储桶。文件上传后即可通过上述 URL 格式访问。

## 9. 在 Rote 中配置存储

在 Rote 管理后台配置存储设置：

```json
{
  "endpoint": "http://localhost:3900",
  "region": "garage",
  "accessKeyId": "<Key ID>",
  "secretAccessKey": "<Secret Key>",
  "bucket": "rote",
  "urlPrefix": "http://rote.web.garage.localhost:3902"
}
```

**说明**：

- `endpoint`: Garage S3 API 地址（端口 3900）
- `urlPrefix`: Web 托管访问地址（端口 3902），用于生成公共访问 URL
- `region`: 固定为 `garage`

## 端口说明

| 端口 | 用途             | 说明                    |
| ---- | ---------------- | ----------------------- |
| 3900 | S3 API           | 用于 S3 兼容的 API 调用 |
| 3901 | RPC 通信         | 节点间通信，不对外暴露  |
| 3902 | Web 静态网站托管 | 用于匿名访问存储的资源  |
| 3903 | 管理 API         | 用于管理操作            |

## 验证配置

### 测试上传文件

```bash
docker run --rm \
  -v $(pwd):/data \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3 cp /data/test.txt s3://rote/test.txt \
  --endpoint-url http://host.docker.internal:3900 \
  --region garage
```

### 测试 Web 访问

```bash
curl -H "Host: rote.web.garage.localhost" http://localhost:3902/test.txt
```

> 自托管 S3 存储，请务必做好备份，避免数据丢失，以下为 ai 生成备份方案，仅供参考

## 备份资源

定期备份 Garage 数据可以防止数据丢失。Garage 的数据存储在以下位置：

- `meta/`：元数据目录（集群布局、bucket 配置、密钥信息等）
- `data/`：实际存储的数据文件
- `garage.toml`：配置文件

### 备份方法

#### 方法 1：完整备份（推荐）

停止服务后备份所有数据：

```bash
cd doc/storage/garage

# 停止服务
docker compose down

# 创建备份目录
mkdir -p ../../../backups/garage_$(date +%Y%m%d_%H%M%S)

# 备份元数据和数据
tar -czf ../../../backups/garage_$(date +%Y%m%d_%H%M%S)/garage_backup.tar.gz \
  meta/ data/ garage.toml docker-compose.yml cors-config.json

# 重新启动服务
docker compose up -d
```

#### 方法 2：在线备份（不停机）

如果需要在服务运行时备份：

```bash
cd doc/storage/garage

# 创建备份目录
mkdir -p ../../../backups/garage_$(date +%Y%m%d_%H%M%S)

# 备份元数据和数据（服务运行时）
tar -czf ../../../backups/garage_$(date +%Y%m%d_%H%M%S)/garage_backup.tar.gz \
  meta/ data/ garage.toml docker-compose.yml cors-config.json
```

**注意**：在线备份时，可能会有少量数据不一致，建议在低峰期进行。

#### 方法 3：使用 rsync 增量备份

```bash
# 创建备份目录
BACKUP_DIR="../../../backups/garage_$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 使用 rsync 同步（支持增量备份）
rsync -av --delete \
  meta/ $BACKUP_DIR/meta/
rsync -av --delete \
  data/ $BACKUP_DIR/data/

# 备份配置文件
cp garage.toml docker-compose.yml cors-config.json $BACKUP_DIR/
```

### 恢复备份

#### 从完整备份恢复

```bash
cd doc/storage/garage

# 停止服务
docker compose down

# 解压备份文件
tar -xzf ../../../backups/garage_YYYYMMDD_HHMMSS/garage_backup.tar.gz

# 启动服务
docker compose up -d

# 验证恢复
docker exec garage /garage bucket list
docker exec garage /garage layout show
```

#### 从增量备份恢复

```bash
cd doc/storage/garage

# 停止服务
docker compose down

# 恢复数据
cp -r ../../../backups/garage_YYYYMMDD/meta/* meta/
cp -r ../../../backups/garage_YYYYMMDD/data/* data/
cp ../../../backups/garage_YYYYMMDD/garage.toml .
cp ../../../backups/garage_YYYYMMDD/docker-compose.yml .
cp ../../../backups/garage_YYYYMMDD/cors-config.json .

# 启动服务
docker compose up -d
```

### 备份访问密钥信息

**重要**：访问密钥的 Secret Key 只在创建时显示一次，建议单独备份：

```bash
# 列出所有密钥
docker exec garage /garage key list

# 将密钥信息保存到文件（手动记录 Key ID 和 Secret Key）
docker exec garage /garage key list > ../../../backups/garage_keys_$(date +%Y%m%d).txt
```

### 备份最佳实践

1. **定期备份**：建议每天或每周备份一次
2. **异地备份**：将备份文件复制到其他服务器或云存储
3. **保留多个版本**：保留最近 7-30 天的备份
4. **验证备份**：定期测试恢复流程，确保备份可用
5. **备份密钥**：单独备份访问密钥信息，避免丢失

### 自动化备份脚本示例

创建 `backup.sh` 脚本：

```bash
#!/bin/bash
cd "$(dirname "$0")"
BACKUP_DIR="../../../backups/garage_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/garage_backup.tar.gz \
  meta/ data/ garage.toml docker-compose.yml cors-config.json

# 备份密钥信息
docker exec garage /garage key list > $BACKUP_DIR/keys.txt 2>/dev/null || true

# 删除 30 天前的备份
find ../../../backups -name "garage_*" -type d -mtime +30 -exec rm -rf {} \;

echo "备份完成: $BACKUP_DIR"
```

使用 cron 定时执行：

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点执行备份
0 2 * * * /path/to/doc/storage/garage/backup.sh
```

## 常见问题

### 1. "0 nodes match" 错误

在执行 `layout assign` 时遇到此错误，通常是因为使用了完整的节点 ID（包含地址部分）。

**解决方案：只使用节点 ID 的 Hash 部分**

```bash
# 正确：只使用 Hash 部分（64 字符的十六进制字符串）
docker exec garage /garage layout assign -z dc1 -c 10G ff41e507c3d46da866e889e464c994d9fc37617975fea2704e21ba51324e6a84

# 错误：不要使用完整的节点 ID（包含 @127.0.0.1:3901）
# docker exec garage /garage layout assign -z dc1 -c 10G ff41e507c3d46da866e889e464c994d9fc37617975fea2704e21ba51324e6a84@127.0.0.1:3901
```

**其他检查步骤**：

```bash
# 查看当前布局状态
docker exec garage /garage layout show

# 确认节点 ID
docker exec garage /garage node id

# 检查服务是否完全启动
docker logs garage
```

### 2. 访问返回 404

- 检查 bucket 是否已创建
- 检查是否已启用网站托管：`docker exec garage /garage bucket website --allow rote`
- 检查文件是否已上传到 bucket

### 3. 权限不足

确保已授予密钥相应权限：

```bash
docker exec garage /garage bucket allow --read --write rote --key <Key ID>
```

### 4. CORS 错误

确保已正确配置 CORS，并且每个 origin 都有独立的规则。

## 更多信息

- 详细文档请参考 [README.md](./README.md)
- [Garage 官方快速启动指南](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
- [Garage 官方完整文档](https://garagehq.deuxfleurs.fr/)
- [Garage GitHub 仓库](https://github.com/deuxfleurs/garage)
