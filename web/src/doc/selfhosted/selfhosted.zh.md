# Rote 自托管部署指南

本指南将帮助你快速部署自己的 Rote 实例，推荐使用 Docker 方式进行部署。

---

## 一、快速开始

Rote 提供了两种部署方式，你可以根据需求选择合适的方式。

### 方式一：使用 Docker Hub 镜像

这是最通用的部署方式，适合大多数用户。

1. **准备配置文件**

   将项目中的 [**docker-compose.yml**](https://github.com/Rabithua/Rote/blob/main/docker-compose.yml) 文件复制到你的服务器。

2. **设置环境变量并启动服务**

   你可以在执行 `docker-compose` 时，直接通过环境变量传参，复制的时候记得修改`ip`和`password`：

   ```bash
   # 使用最新版本（默认配置）
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=latest \
   docker-compose up -d

   # 使用特定版本（例如 v1.0.0）
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=v1.0.0 \
   docker-compose up -d
   ```

   启动完成后：
   - 后端默认监听：`http://<your-ip-address>:18000`
   - 前端默认监听：`http://<your-ip-address>:18001`

### 方式二：使用 Dokploy（推荐）

Dokploy 是一个开源的 Docker 部署平台，提供了可视化的应用部署和管理界面。

1. **访问 Dokploy**

   在浏览器中打开你的 Dokploy 管理界面。

2. **使用模版部署**

   `Create Service` -> `Template` -> Search `Rote` -> `Create`

3. **配置域名（可选）**
   - 默认部署会使用 Dokploy 自动生成的域名。
   - 如果需要为 Rote 配置自定义域名，请记得修改环境变量：

     ```bash
     VITE_API_BASE=http://your-domain.com
     # 或
     VITE_API_BASE=https://your-domain.com
     ```

---

## 二、配置说明

Rote 使用环境变量进行配置，主要配置项如下。

### 1. 必需配置

- **VITE_API_BASE：**  
  前端访问后端的 API 地址，必须与你的实际部署地址一致，例如：

  ```bash
  VITE_API_BASE=http://your-ip-address:18000
  VITE_API_BASE=https://your-domain.com
  ```

### 2. 可选配置

- **POSTGRES_PASSWORD：**  
  PostgreSQL 数据库密码（默认：`rote_password_123`，**生产环境请务必修改**）。

- **IMAGE_TAG：**  
  指定使用的 Docker 镜像版本（默认：`latest`），例如：

  ```bash
  IMAGE_TAG=v1.0.0
  ```

### 3. 高级配置

更多配置选项（如 OAuth、文件存储、邮件服务等）可以在部署后通过管理后台进行配置。  
首次部署完成后，打开链接会进入初始化引导，可进行详细配置。

---

## 三、服务端口

默认情况下，Rote 使用以下端口：

- **18000：** 后端 API 服务端口
- **18001：** 前端 Web 服务端口
- **5432：** PostgreSQL 数据库端口（容器内部，不对外暴露）

如果需要修改端口，可以在 `docker-compose.yml` 文件中修改 `ports` 配置。

---

## 四、数据备份和迁移

Rote 使用 Docker 卷来存储数据，备份和迁移非常简单。

### 1. 备份数据

#### 1.1 备份数据库

在宿主机上执行：

```bash
# 导出数据库
docker exec rote-postgres pg_dump -U rote rote > rote_backup_$(date +%Y%m%d).sql
```

#### 1.2 备份文件存储

如果配置了文件存储（如 S3 / R2），请按照对应服务商的备份方案进行备份。

### 2. 迁移数据

#### 2.1 在新服务器上部署 Rote

按照「快速开始」中的步骤，在新服务器上完成 Rote 部署。

#### 2.2 恢复数据库

将备份文件上传到新服务器后执行：

```bash
# 导入数据库
docker exec -i rote-postgres psql -U rote rote < rote_backup_YYYYMMDD.sql
```

#### 2.3 迁移文件存储

- 如果使用云存储（S3 / R2），通常不需要额外迁移，只要新环境配置相同的密钥和 Bucket 即可。

---

## 五、常见问题（FAQ）

### 1. 服务无法启动

- **检查端口占用：**  
  确保 `18000` 和 `18001` 端口未被其他程序占用。

- **检查 Docker 状态：**
  - 使用 `docker ps` 查看容器是否正常运行。
  - 使用 `docker logs rote-backend` 查看后端容器日志。
  - 使用 `docker logs rote-postgres` 查看数据库日志。

- **检查环境变量：**  
  确保 `.env` 中的 `VITE_API_BASE`、`POSTGRESQL_URL` 等配置正确。

### 2. 前端无法连接后端

- **检查 VITE_API_BASE：**  
  确保前端使用的后端地址可以在浏览器中正常访问。

- **检查网络和反向代理：**  
  如果使用 Nginx / Caddy 等反向代理，确认代理配置正确，路径和端口转发无误。

- **检查防火墙：**  
  确保服务器防火墙允许相应端口（如 80、443、18000、18001）的访问。

### 3. 数据库连接失败

- **检查数据库容器：**  
  使用 `docker logs rote-postgres` 查看数据库日志，确认是否正常启动。

- **检查连接字符串：**  
  确保 `POSTGRESQL_URL` 中的用户名、密码、主机、端口、数据库名均正确。

- **等待数据库就绪：**  
  首次启动时数据库需要一些时间初始化，如果后端先启动可能会暂时连不上数据库，稍等片刻即可。

### 4. 如何更新版本

1. **备份数据**

   按照上文「数据备份」步骤先备份数据库和文件存储。

2. **拉取新镜像**

   ```bash
   # 拉取最新镜像
   docker-compose pull

   # 或指定版本
   IMAGE_TAG=v1.0.0 docker-compose pull
   ```

3. **重启服务**

   ```bash
   docker-compose up -d
   ```

---

## 六、获取帮助

如果在部署过程中遇到问题，可以通过以下方式获取帮助：

- **GitHub Issues：** https://github.com/rabithua/rote/issues
- **高危漏洞：** rabithua@gmail.com
