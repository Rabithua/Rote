[English](README.md) | [中文](README.zh.md)

![Group 1](https://github.com/Rabithua/Rote/assets/34543831/a06d5a5b-0580-4138-9282-449a725cd287)

> 一个看起来不一样的个人笔记仓库 🤔

- 开放 API，不止一种记录方式 🤩
- 自主掌控数据，来去自由，不做数据绑架 🙅🏻
- 使用 Docker 一键部署，数据备份和迁移如喝水般简单 👌

## 部署

### 快速开始

#### 方式一：使用 Docker Hub 镜像（推荐）

> 复制 `docker-compose.yml` 到你的已经装好 Docker 和 Docker Compose 的服务器
> 注意：如果你使用反向代理的话，VITE_API_BASE 应该是你反向代理后的后端地址

```bash
# 使用最新版本（默认配置文件）
VITE_API_BASE=http://<your-ip-address>:18000 docker-compose up -d

# 使用特定版本
IMAGE_TAG=v1.0.0 docker-compose up -d
```

#### 方式二：本地构建

```bash
# 克隆仓库
git clone https://github.com/Rabithua/Rote.git
cd Rote

# 从源码构建并启动
# VITE_API_BASE 在构建时注入到前端代码中（可选，默认 http://localhost:18000）
VITE_API_BASE=http://localhost:18000 docker-compose -f docker-compose.build.yml up -d --build
```

### 详细说明

更多部署选项和配置说明，请查看 `doc/` 目录下的文档。

## 技术栈

<img width="866" height="526" alt="technology" src="https://github.com/user-attachments/assets/2be3a73b-467e-4d4b-8d9f-2a129aba4825" />
