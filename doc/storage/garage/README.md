# Garage 使用指南

Garage 是一个去中心化的对象存储系统，兼容 S3 API，可用于存储文件、托管静态网站等。

> **官方文档**：本指南基于 Garage 官方文档编写，更多详细信息请参考 [Garage 官方文档](https://garagehq.deuxfleurs.fr/) 和 [快速启动指南](https://garagehq.deuxfleurs.fr/documentation/quick-start/)。

## 目录

- [快速开始](#快速开始)
- [初始化配置](#初始化配置)
- [基本操作](#基本操作)
- [S3 连接配置](#s3-连接配置)
- [网站托管](#网站托管)
- [访问密钥管理](#访问密钥管理)
- [端口说明](#端口说明)
- [常见问题](#常见问题)

## 快速开始

### 生成配置文件（首次使用）

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

### 启动服务

```bash
cd doc/storage/garage
docker compose up -d
```

### 检查服务状态

```bash
docker logs garage
```

## 初始化配置

首次使用 Garage 需要初始化集群布局。

### 1. 获取节点 ID

```bash
docker exec garage /garage node id
```

输出示例：

```
d2b72b8cc3e340605d2c8a42b5eab4cd28363c2072671e4ac50f1914cfd76b8f@127.0.0.1:3901
```

### 2. 将节点添加到布局

将节点分配到数据中心并设置容量（至少 1K，建议使用 G 或 T 单位）：

```bash
docker exec garage /garage layout assign -z dc1 -c 10G <节点ID>
```

示例：

```bash
docker exec garage /garage layout assign -z dc1 -c 10G d2b72b8cc3e340605d2c8a42b5eab4cd28363c2072671e4ac50f1914cfd76b8f
```

### 3. 应用布局

```bash
docker exec garage /garage layout apply --version 1
```

### 4. 验证布局

```bash
docker exec garage /garage layout show
```

如果看到节点信息，说明初始化成功。

## 基本操作

### 创建 Bucket

```bash
docker exec garage /garage bucket create <bucket-name>
```

示例：

```bash
docker exec garage /garage bucket create my-bucket
```

### 列出所有 Bucket

```bash
docker exec garage /garage bucket list
```

### 查看 Bucket 信息

```bash
docker exec garage /garage bucket info <bucket-name>
```

### 删除 Bucket

```bash
docker exec garage /garage bucket delete <bucket-name>
```

**注意**：删除 bucket 前需要先清空其中的所有对象。

### 配置 CORS（跨域资源共享）

如果前端应用需要直接上传文件到 Garage，需要配置 CORS 策略。

#### 1. 创建 CORS 配置文件

创建 `cors-config.json` 文件：

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

**重要提示**：每个 origin 必须配置为单独的 CORS 规则。如果在一个规则中包含多个 origin，Garage 会将它们合并成一个逗号分隔的字符串返回，这会导致浏览器报错："The 'Access-Control-Allow-Origin' header contains multiple values, but only one is allowed"。因此，每个需要支持的 origin 都应该有自己独立的规则。

**配置说明：**

- `AllowedOrigins`: 允许的前端域名列表
- `AllowedMethods`: 允许的 HTTP 方法
- `AllowedHeaders`: 允许的请求头（`*` 表示所有）
- `ExposeHeaders`: 暴露给前端的响应头
- `MaxAgeSeconds`: 预检请求的缓存时间（秒）

#### 2. 授予密钥 Owner 权限

配置 CORS 需要 bucket 的 owner 权限：

```bash
docker exec garage /garage bucket allow --owner <bucket-name> --key <key-id>
```

#### 3. 使用 AWS CLI 设置 CORS

```bash
docker run --rm \
  -v $(pwd)/cors-config.json:/tmp/cors-config.json \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3api put-bucket-cors \
  --bucket <bucket-name> \
  --cors-configuration file:///tmp/cors-config.json \
  --endpoint-url http://host.docker.internal:3900 \
  --region garage
```

#### 4. 验证 CORS 配置

```bash
docker run --rm \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3api get-bucket-cors \
  --bucket <bucket-name> \
  --endpoint-url http://host.docker.internal:3900 \
  --region garage
```

#### 5. 删除 CORS 配置

```bash
docker run --rm \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3api delete-bucket-cors \
  --bucket <bucket-name> \
  --endpoint-url http://host.docker.internal:3900 \
  --region garage
```

**注意**：如果前端应用运行在不同的域名或端口，需要将对应的 origin 添加到 `AllowedOrigins` 列表中。

## S3 连接配置

Garage 兼容 S3 API，可以使用各种 S3 客户端和 SDK 连接。

### 获取访问密钥

首先需要创建访问密钥，详见 [访问密钥管理](#访问密钥管理) 章节。

### 方法 1：使用 AWS CLI

#### 安装 AWS CLI

**macOS:**

```bash
brew install awscli
```

**Linux:**

```bash
pip install awscli
```

**或使用 Docker:**

```bash
docker pull amazon/aws-cli
```

#### 配置环境变量

```bash
export AWS_ACCESS_KEY_ID=<你的Key ID>
export AWS_SECRET_ACCESS_KEY=<你的Secret Key>
export AWS_ENDPOINT_URL=http://localhost:3900
export AWS_DEFAULT_REGION=garage
```

#### 使用 AWS CLI 命令

**列出所有 bucket:**

```bash
aws s3 ls --endpoint-url http://localhost:3900
```

**上传文件:**

```bash
aws s3 cp local-file.txt s3://bucket-name/path/to/file.txt --endpoint-url http://localhost:3900
```

**下载文件:**

```bash
aws s3 cp s3://bucket-name/path/to/file.txt local-file.txt --endpoint-url http://localhost:3900
```

**同步目录:**

```bash
aws s3 sync ./local-folder s3://bucket-name/folder/ --endpoint-url http://localhost:3900
```

**删除文件:**

```bash
aws s3 rm s3://bucket-name/path/to/file.txt --endpoint-url http://localhost:3900
```

#### 使用 Docker 运行 AWS CLI

如果不想安装 AWS CLI，可以使用 Docker：

```bash
docker run --rm \
  -v $(pwd):/data \
  -e AWS_ACCESS_KEY_ID=<Key ID> \
  -e AWS_SECRET_ACCESS_KEY=<Secret Key> \
  amazon/aws-cli \
  s3 ls --endpoint-url http://host.docker.internal:3900
```

### 方法 2：使用 AWS CLI 配置文件

创建 `~/.aws/config` 文件：

```ini
[default]
region = garage
s3 =
    endpoint_url = http://localhost:3900
```

创建 `~/.aws/credentials` 文件：

```ini
[default]
aws_access_key_id = <你的Key ID>
aws_secret_access_key = <你的Secret Key>
```

配置后可以直接使用命令，无需 `--endpoint-url` 参数：

```bash
aws s3 ls
aws s3 cp file.txt s3://bucket-name/file.txt
```

### 方法 3：使用 Python boto3

#### 安装 boto3

```bash
pip install boto3
```

#### 连接代码示例

```python
import boto3

# 创建 S3 客户端
s3_client = boto3.client(
    's3',
    endpoint_url='http://localhost:3900',
    aws_access_key_id='<你的Key ID>',
    aws_secret_access_key='<你的Secret Key>',
    region_name='garage'
)

# 列出所有 bucket
buckets = s3_client.list_buckets()
for bucket in buckets['Buckets']:
    print(bucket['Name'])

# 上传文件
s3_client.upload_file('local-file.txt', 'bucket-name', 'path/to/file.txt')

# 下载文件
s3_client.download_file('bucket-name', 'path/to/file.txt', 'local-file.txt')

# 列出 bucket 中的对象
objects = s3_client.list_objects_v2(Bucket='bucket-name')
for obj in objects.get('Contents', []):
    print(obj['Key'])
```

### 方法 4：使用 Node.js AWS SDK

#### 安装依赖

```bash
npm install @aws-sdk/client-s3
```

#### 连接代码示例

```javascript
const {
  S3Client,
  ListBucketsCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");

// 创建 S3 客户端
const s3Client = new S3Client({
  endpoint: "http://localhost:3900",
  region: "garage",
  credentials: {
    accessKeyId: "<你的Key ID>",
    secretAccessKey: "<你的Secret Key>",
  },
  forcePathStyle: true, // 使用路径风格访问
});

// 列出所有 bucket
async function listBuckets() {
  const command = new ListBucketsCommand({});
  const response = await s3Client.send(command);
  console.log(response.Buckets);
}

// 上传文件
async function uploadFile() {
  const fileContent = fs.readFileSync("local-file.txt");
  const command = new PutObjectCommand({
    Bucket: "bucket-name",
    Key: "path/to/file.txt",
    Body: fileContent,
  });
  await s3Client.send(command);
  console.log("文件上传成功");
}
```

### 方法 5：使用 curl（测试连接）

使用 curl 测试 S3 API 连接：

```bash
# 列出 bucket（需要签名，这里仅作示例）
curl -X GET \
  -H "Host: s3.garage.localhost" \
  http://localhost:3900/
```

**注意**：直接使用 curl 需要手动计算 AWS Signature，建议使用 SDK 或 CLI 工具。

### 测试连接

使用以下命令测试连接是否正常：

```bash
# 使用 AWS CLI
aws s3 ls --endpoint-url http://localhost:3900

# 或使用 Python
python3 -c "
import boto3
s3 = boto3.client('s3', endpoint_url='http://localhost:3900',
                   aws_access_key_id='<Key ID>',
                   aws_secret_access_key='<Secret Key>',
                   region_name='garage')
print(s3.list_buckets())
"
```

### URL 前缀说明

Garage 支持两种 URL 访问方式：

#### 1. 路径风格（Path Style）

**格式：** `http://<endpoint>/<bucket-name>/<object-key>`

**示例：**

```
http://localhost:3900/bucket-name/file.txt
http://localhost:3900/bucket-name/folder/image.jpg
```

**URL 前缀：** `http://localhost:3900/bucket-name/`

#### 2. 虚拟主机风格（Virtual Host Style）

**格式：** `http://<bucket-name>.<root-domain>:<port>/<object-key>`

根据 `garage.toml` 配置，`root_domain = ".s3.garage.localhost"`，所以：

**示例：**

```
http://bucket-name.s3.garage.localhost:3900/file.txt
http://bucket-name.s3.garage.localhost:3900/folder/image.jpg
```

**URL 前缀：** `http://bucket-name.s3.garage.localhost:3900/`

**注意：** 使用虚拟主机风格需要配置 hosts 文件或 DNS：

```
127.0.0.1 bucket-name.s3.garage.localhost
```

#### 3. Web 托管 URL 前缀

对于启用了网站托管的 bucket，访问格式为：

**格式：** `http://<bucket-name>.<web-root-domain>:<port>/<object-key>`

根据配置 `root_domain = ".web.garage.localhost"`：

**示例：**

```
http://bucket-name.web.garage.localhost:3902/
http://bucket-name.web.garage.localhost:3902/index.html
http://bucket-name.web.garage.localhost:3902/assets/style.css
```

**URL 前缀：** `http://bucket-name.web.garage.localhost:3902/`

#### 4. 在代码中使用 URL 前缀

**Python boto3 示例：**

```python
import boto3

s3_client = boto3.client('s3', endpoint_url='http://localhost:3900', ...)

# 获取对象的公共 URL（路径风格）
url = f"http://localhost:3900/{bucket_name}/{object_key}"

# 或使用虚拟主机风格
url = f"http://{bucket_name}.s3.garage.localhost:3900/{object_key}"
```

**Node.js 示例：**

```javascript
const url = `http://localhost:3900/${bucketName}/${objectKey}`;
// 或
const url = `http://${bucketName}.s3.garage.localhost:3900/${objectKey}`;
```

### 连接参数总结

无论使用哪种方式，都需要以下参数：

- **Endpoint URL**: `http://localhost:3900`（本地）或 `http://<服务器IP>:3900`（远程）
- **Region**: `garage`（根据 garage.toml 中的 s3_region 配置）
- **Access Key ID**: 通过 `garage key create` 创建
- **Secret Access Key**: 创建密钥时获取
- **Path Style**: **必须启用**（所有 SDK 都需要设置 `forcePathStyle: true`）

**重要提示**：Garage 使用路径风格的 URL 访问，因此在配置 S3 客户端时，必须设置 `forcePathStyle: true`，否则会出现连接错误。

## 网站托管

### 启用网站托管

```bash
docker exec garage /garage bucket website --allow <bucket-name>
```

### 禁用网站托管

```bash
docker exec garage /garage bucket website --deny <bucket-name>
```

### 上传文件到 Bucket

上传文件的方法请参考 [S3 连接配置](#s3-连接配置) 章节，其中详细介绍了使用 AWS CLI、Python boto3、Node.js SDK 等多种方式上传文件。

**快速上传示例（使用 AWS CLI）:**

```bash
aws s3 cp index.html s3://<bucket-name>/index.html --endpoint-url http://localhost:3900
```

### 访问托管网站

根据 `garage.toml` 配置，网站访问格式为：

```
http://<bucket-name>.web.garage.localhost:3902/
```

**在浏览器中访问**：

1. 配置 hosts 文件（`/etc/hosts`）：

   ```
   127.0.0.1 <bucket-name>.web.garage.localhost
   ```

2. 访问：`http://<bucket-name>.web.garage.localhost:3902/`

**使用 curl 测试**：

```bash
curl -H "Host: <bucket-name>.web.garage.localhost" http://localhost:3902/
```

## 访问密钥管理

### 创建访问密钥

```bash
docker exec garage /garage key create <key-name>
```

输出示例：

```
==== ACCESS KEY INFORMATION ====
Key ID:              GK43059777c3107d797e4734f2
Key name:            test-key
Secret key:          d04427ce0a022486285c23c3853553c7f59e16d955d23d56ccaa0037bdf9719b
```

**重要**：请妥善保存 Secret Key，它只会显示一次。

### 列出所有密钥

```bash
docker exec garage /garage key list
```

### 查看密钥信息

```bash
docker exec garage /garage key info <key-id>
```

### 授予 Bucket 权限

```bash
docker exec garage /garage bucket allow --read --write <bucket-name> --key <key-id>
```

权限选项：

- `--read`：读取权限
- `--write`：写入权限
- `--owner`：所有者权限（包含所有权限）

### 撤销 Bucket 权限

```bash
docker exec garage /garage bucket deny --read --write <bucket-name> --key <key-id>
```

### 删除密钥

```bash
docker exec garage /garage key delete <key-id>
```

## 端口说明

| 端口 | 用途             | 说明                                               |
| ---- | ---------------- | -------------------------------------------------- |
| 3900 | S3 API           | 用于 S3 兼容的 API 调用（创建 bucket、上传文件等） |
| 3901 | RPC 通信         | 节点间通信，不对外暴露                             |
| 3902 | Web 静态网站托管 | 用于访问托管的静态网站                             |
| 3903 | 管理 API         | 用于管理操作（需要 admin_token）                   |
| 3904 | K2V API          | Key-Value 存储 API                                 |

## 常见问题

### 1. "Layout not ready" 错误

**原因**：集群布局未初始化。

**解决方法**：按照 [初始化配置](#初始化配置) 章节的步骤初始化布局。

### 2. 访问网站返回 404

**原因**：

- 没有创建 bucket
- bucket 未启用网站托管
- bucket 中没有 `index.html` 文件

**解决方法**：

1. 创建 bucket 并启用网站托管
2. 上传 `index.html` 文件到 bucket 根目录
3. 使用正确的域名格式访问

### 3. 上传文件时提示权限不足

**原因**：访问密钥没有该 bucket 的写入权限。

**解决方法**：

```bash
docker exec garage /garage bucket allow --write <bucket-name> --key <key-id>
```

### 4. 删除 bucket 失败

**原因**：bucket 中还有对象未删除。

**解决方法**：

1. 先删除 bucket 中的所有对象
2. 然后再删除 bucket

### 5. 容器重启后数据丢失

**原因**：数据卷挂载配置不正确。

**解决方法**：确保 `docker-compose.yml` 中的 volumes 配置正确：

```yaml
volumes:
  - ./garage.toml:/etc/garage.toml
  - ./meta:/var/lib/garage/meta
  - ./data:/var/lib/garage/data
```

同时确保 `garage.toml` 中的路径与挂载路径一致：

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
```

## 配置文件说明

### docker-compose.yml

- `image`: Garage Docker 镜像版本
- `ports`: 端口映射
- `volumes`: 数据卷挂载
- `environment`: 环境变量（日志级别等）

### garage.toml

**重要**：首次使用时应使用官方方法生成包含随机密钥的配置文件，不要直接使用示例配置文件。

生成方法：

```bash
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

主要配置项：

- `metadata_dir`: 元数据存储目录（本配置使用 `/var/lib/garage/meta` 用于持久化，官方快速启动指南使用 `/tmp/meta` 用于测试）
- `data_dir`: 数据存储目录（本配置使用 `/var/lib/garage/data` 用于持久化，官方快速启动指南使用 `/tmp/data` 用于测试）
- `db_engine`: 数据库引擎（sqlite/lmdb）
- `replication_factor`: 复制因子（单节点设为 1）
- `rpc_bind_addr`: RPC 绑定地址
- `rpc_public_addr`: RPC 公网地址
- `rpc_secret`: RPC 通信密钥（使用 `openssl rand -hex 32` 生成）
- `[s3_api]`: S3 API 配置
- `[s3_web]`: Web 托管配置
- `[admin]`: 管理 API 配置
  - `admin_token`: 管理令牌（使用 `openssl rand -base64 32` 生成）
  - `metrics_token`: 指标令牌（使用 `openssl rand -base64 32` 生成）

## 公共访问配置

### 限制说明

**Garage 目前不支持匿名访问**。错误信息：`Garage does not support anonymous access yet`

这意味着无法直接通过 HTTP 请求访问存储桶中的文件，即使配置了 bucket policy 也无法实现匿名访问。

### 解决方案

由于 Garage 不支持匿名访问，Rote 项目通过**服务器端代理**来实现公共文件访问：

1. **公共访问路由**：`GET /v2/api/attachments/public/:key`

   - 例如：`http://localhost:3000/v2/api/attachments/public/users/xxx/uploads/xxx.png`
   - 服务器使用配置的访问密钥从 Garage 获取文件，然后返回给客户端

2. **URL 配置**：

   - 在存储配置中，`urlPrefix` 应设置为服务器代理地址
   - 例如：`urlPrefix: "http://localhost:3000/v2/api/attachments/public"`
   - 这样生成的附件 URL 会通过服务器代理访问

3. **性能考虑**：
   - 服务器代理会增加服务器负载
   - 建议在生产环境中使用支持匿名访问的存储服务（如 Cloudflare R2、AWS S3）
   - 或者等待 Garage 未来版本支持匿名访问

### 配置示例

在 Rote 的存储配置中：

```json
{
  "endpoint": "http://localhost:3900",
  "region": "garage",
  "accessKeyId": "GK...",
  "secretAccessKey": "...",
  "bucket": "rote",
  "urlPrefix": "http://localhost:3000/v2/api/attachments/public"
}
```

这样，所有附件的 URL 都会通过服务器代理访问，实现公共访问。

### 预签名 URL（推荐方式）

虽然 Garage 不支持匿名访问，但**支持预签名 URL**，这是更好的解决方案：

1. **预签名 URL 的优势**：

   - 客户端直接访问 S3，不经过服务器，性能更好
   - 临时访问权限，过期后自动失效，更安全
   - 减少服务器负载

2. **生成预签名下载 URL**：

   ```typescript
   import { presignGetUrl } from "../utils/r2";

   // 生成 1 小时有效的下载链接
   const signedUrl = await presignGetUrl("users/xxx/uploads/file.png", 3600);

   // 生成 24 小时有效的下载链接
   const longLivedUrl = await presignGetUrl(
     "users/xxx/uploads/file.png",
     86400
   );
   ```

3. **通过 API 获取预签名 URL**：

   ```
   GET /v2/api/attachments/presign-download/:key?expiresIn=3600
   Authorization: Bearer <token>
   ```

   响应示例：

   ```json
   {
     "code": 0,
     "message": "success",
     "data": {
       "signedUrl": "http://localhost:3900/rote/users/xxx/uploads/file.png?X-Amz-Algorithm=...",
       "expiresIn": 3600,
       "expiresAt": "2025-12-29T15:30:00.000Z"
     }
   }
   ```

4. **过期时间限制**：

   - 最短：60 秒（1 分钟）
   - 最长：604800 秒（7 天）
   - 默认：3600 秒（1 小时）

5. **使用场景**：
   - **临时分享**：15 分钟 - 1 小时
   - **一般访问**：1-24 小时
   - **长期访问**：考虑使用服务器代理或公共访问

## 更多资源

- [Garage 官方文档](https://garagehq.deuxfleurs.fr/)
- [Garage 官方快速启动指南](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
- [Garage GitHub 仓库](https://github.com/deuxfleurs/garage)
