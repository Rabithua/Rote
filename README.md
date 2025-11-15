[English](README.md) | [中文](README.zh.md)

![Group 1](https://github.com/Rabithua/Rote/assets/34543831/a06d5a5b-0580-4138-9282-449a725cd287)

> A personal note repository that looks different🤔

- Open API, more than one way to record🤩
- Take control of your own data, come and go freely, no data hostage🙅🏻
- Using Docker for one-click deployment, data backup and migration are as easy as drinking water👌

## Deploy

### Quick Start

#### Method 1: Using Docker Hub Image (Recommended)

> Copy `docker-compose.yml` to your server with Docker and Docker Compose installed
> Note: If you use a reverse proxy, VITE_API_BASE should be your backend address after the reverse proxy

```bash
# Use latest version (default config file)
VITE_API_BASE=http://<your-ip-address>:3000 docker-compose up -d

# Use specific version
IMAGE_TAG=v1.0.0 docker-compose up -d
```

#### Method 2: Local Build

```bash
# Clone the repository
git clone https://github.com/Rabithua/Rote.git
cd Rote

# Build and start from source
# VITE_API_BASE is injected into frontend code at build time (optional, default http://localhost:3000)
VITE_API_BASE=http://localhost:3000 docker-compose -f docker-compose.build.yml up -d --build
```

### Detailed Instructions

For more deployment options and configuration instructions, please check the documentation in the `doc/` directory.

## Technology Stack

![Frame 1](https://github.com/Rabithua/Rote/assets/34543831/fc00f797-82bc-47fe-8c75-36ea0b1f6f76)
