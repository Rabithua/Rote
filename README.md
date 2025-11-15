![Group 1](https://github.com/Rabithua/Rote/assets/34543831/a06d5a5b-0580-4138-9282-449a725cd287)

> A personal note repository that looks different🤔

- Open API, more than one way to record🤩
- Take control of your own data, come and go freely, no data hostage🙅🏻
- Using docker for one-click deployment, data backup and migration are as easy as drinking water👌

## Deploy

### 快速开始

#### 方式一：使用 Docker Hub 镜像（推荐）

```bash
# 使用最新版本（默认配置文件）
docker-compose up -d

# 使用特定版本
IMAGE_TAG=v1.0.0 docker-compose up -d
```

#### 方式二：本地构建

```bash
# 从源码构建并启动
# VITE_API_BASE 在构建时注入到前端代码中（可选，默认 http://localhost:3000）
VITE_API_BASE=http://localhost:3000 docker-compose -f docker-compose.build.yml up -d --build
```

### 详细说明

更多部署选项和配置说明，请查看 [Docker Compose 使用指南](doc/userguide/DOCKER-COMPOSE-GUIDE.md)。

## Technology stack

![Frame 1](https://github.com/Rabithua/Rote/assets/34543831/fc00f797-82bc-47fe-8c75-36ea0b1f6f76)
