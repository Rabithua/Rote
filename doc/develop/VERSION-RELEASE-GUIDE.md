# 版本发布构建指南

本文档说明如何通过 GitHub Release 触发版本构建和部署。

## 发布版本的两种方式

### 方式 1: 通过 GitHub Release 发布（推荐）

这是推荐的版本发布方式，会自动触发 Docker 镜像构建。

#### 步骤

1. **创建 Git 标签**

   ```bash
   # 创建带注释的标签（推荐）
   git tag -a v1.0.0 -m "Release version 1.0.0"

   # 推送到远程
   git push origin v1.0.0
   ```

2. **在 GitHub 上创建 Release**

   - 访问 GitHub 仓库页面
   - 点击右侧 "Releases" → "Draft a new release"
   - 选择刚创建的标签（如 `v1.0.0`）
   - 填写 Release 标题和描述
   - 点击 "Publish release"

3. **自动触发构建**
   - GitHub Actions 会自动检测到 Release 发布事件
   - 触发 `release-deploy.yml` workflow
   - 自动构建并推送 Docker 镜像到 Docker Hub

#### 生成的 Docker 镜像标签

发布 `v1.0.0` 版本后，会生成以下镜像：

- **后端镜像**:

  - `rote-backend:latest`
  - `rote-backend:v1.0.0`

- **前端镜像**:
  - `rote-frontend:latest`
  - `rote-frontend:v1.0.0`

### 方式 2: 直接推送到 main 分支

直接推送到 `main` 分支也会触发构建，但不会使用版本标签。

```bash
git checkout main
git merge develop
git push origin main
```

#### 生成的 Docker 镜像标签

- **后端镜像**: `rote-backend:latest`, `rote-backend:main`
- **前端镜像**: `rote-frontend:latest`, `rote-frontend:main`

## 版本号规范

建议使用 [语义化版本](https://semver.org/) 规范：

- **主版本号** (MAJOR): 不兼容的 API 修改
- **次版本号** (MINOR): 向下兼容的功能性新增
- **修订号** (PATCH): 向下兼容的问题修正

示例：

- `v1.0.0` - 首个稳定版本
- `v1.1.0` - 新增功能
- `v1.1.1` - 修复 bug
- `v2.0.0` - 重大更新，不兼容旧版本

## 环境变量配置

在 GitHub Repository Settings → Secrets 中配置：

- `DOCKERHUB_USERNAME`: Docker Hub 用户名
- `DOCKERHUB_TOKEN`: Docker Hub 访问令牌
- `VITE_API_BASE`: 前端 API 基础 URL（生产环境必须配置）

## 验证构建

构建完成后，可以在以下位置验证：

1. **GitHub Actions**: 查看 workflow 运行状态
2. **Docker Hub**: 检查镜像是否已推送
   - 访问 `https://hub.docker.com/r/<username>/rote-backend/tags`
   - 访问 `https://hub.docker.com/r/<username>/rote-frontend/tags`

## 使用构建的镜像

### Docker Compose

```yaml
services:
  rote-backend:
    image: <username>/rote-backend:v1.0.0
    # ...

  rote-frontend:
    image: <username>/rote-frontend:v1.0.0
    # ...
```

### Docker 命令

```bash
# 拉取特定版本
docker pull <username>/rote-backend:v1.0.0
docker pull <username>/rote-frontend:v1.0.0

# 运行容器
docker run -d <username>/rote-backend:v1.0.0
docker run -d <username>/rote-frontend:v1.0.0
```

## 故障排查

### 构建失败

1. 检查 GitHub Actions 日志
2. 确认 Secrets 配置正确
3. 检查 Dockerfile 是否有语法错误
4. 确认代码已推送到正确的分支

### 镜像标签不正确

- 检查 workflow 中的标签逻辑
- 确认 Release 标签格式正确（建议使用 `v` 前缀）

## 注意事项

1. **生产环境**: 发布到 `main` 分支或创建 Release 前，确保代码已充分测试
2. **版本标签**: 建议使用带 `v` 前缀的标签（如 `v1.0.0`）
3. **环境变量**: 生产环境必须配置 `VITE_API_BASE`，否则会使用默认值
4. **镜像标签**: `latest` 标签始终指向最新构建，建议生产环境使用具体版本号
