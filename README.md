<p align="right">English | <a href="doc/README.zh.md">中文</a></p>

<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="doc/assets/imgs/v2.0-dark.svg">
    <img src="doc/assets/imgs/v2.0.svg" width="176" height="28" alt="Rote v2.0 AI is ready">
  </picture>
</p>

<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="doc/assets/imgs/logo-dark.svg">
    <img src="doc/assets/imgs/logo.svg" width="202" height="48" alt="Rote">
  </picture>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Rabithua/Rote.svg?style=social&label=Star)](https://github.com/Rabithua/Rote)
[![GitHub forks](https://img.shields.io/github/forks/Rabithua/Rote.svg?style=social&label=Fork)](https://github.com/Rabithua/Rote/fork)

**[Demo](https://demo.rote.ink/)** ｜ **[Website](https://rote.ink)** ｜ **[iOS APP](https://apps.apple.com/us/app/rote/id6755513897)** ｜ **[Explore](https://rote.ink/explore)** ｜ **[Rabithua](https://rote.ink/rabithua)**

> Open API, more than one way to record 🤩, supports Self-Hosted, take control of your own data, come and go freely, no data hostage 🙅🏻

### Preview

![Rote Preview](doc/assets/imgs/github_preview_img.png)

### Core Features

- **Stay Restrained**: Everything for an elegant note-taking experience and restrained interaction
- **Low Mental Burden**: Less pressure and simpler, more intuitive recording experience, even deployment experience
- **Open Interface**: Open API interface, supports recording or getting data in any scenario
- **Unbounded Freedom**: Complete control over your data, free to export data
- **Self-Hosted Deployment**: One-click deployment using Docker or Dokploy
- **Separated Architecture**: Frontend and backend use separated architecture design, deploy only the services you need
- **Markdown Articles**: Standalone Article support, can be referenced by notes, offering a pure writing and reading experience
- **Memory**: Optional AI chat over your own notes and articles, with semantic search, related notes, streamed responses, and source references
- **Admin-Controlled AI**: AI, vector storage, automatic indexing, and public semantic discovery are disabled by default and must be explicitly enabled by an administrator
- **iOS Client**: More elegant App client

### Quick Start

#### Method 1: Using Docker Hub Image

Copy [docker-compose.yml](docker-compose.yml) to your server with Docker and Docker Compose installed

> Note: If you use a reverse proxy, VITE_API_BASE should be your backend address after the reverse proxy
>
> Rote now uses `pgvector/pgvector:pg17-trixie` by default. It behaves like PostgreSQL 17 and additionally supports the optional AI vector extension. Plain `postgres:17` is only a temporary compatibility path and may not be supported by future Rote versions.
>
> `latest` is the stable image. If you are reading the develop branch documentation or testing unreleased Memory features, use `IMAGE_TAG=develop`.

```bash
# 1. Create a .env file beside docker-compose.yml
cat > .env <<'EOF'
VITE_API_BASE=http://YOUR_SERVER_IP:18000
POSTGRES_PASSWORD=change_this_password
EOF

# 2. Replace YOUR_SERVER_IP and change_this_password before first start.
#    Use a strong URL-safe password. Avoid characters such as @ : / # % in POSTGRES_PASSWORD.
#    Keep this password unchanged after the database volume has been initialized.

# 3. Start Rote with the latest stable image
docker compose up -d
```

Optional `.env` values:

```bash
# Use a specific version
IMAGE_TAG=v1.0.0

# Use the develop branch image for testing unreleased features
IMAGE_TAG=develop

# Use plain PostgreSQL without pgvector.
# Compatibility-only; future Rote versions may require pgvector-capable PostgreSQL.
POSTGRES_IMAGE=postgres:17
```

After the containers are running:

1. Open `http://<your-ip-address>:18001`.
2. Complete the setup page and create the first administrator account.
3. Sign in and configure site settings from the Admin dashboard.
4. Optional: if your image tag includes Memory support, open `Admin -> AI Settings` to configure chat and embedding providers, enable pgvector, and backfill existing notes/articles.

#### Method 2: Using Dokploy (Recommended)

Dokploy is an open-source Docker deployment platform that provides a visual interface for application deployment and management. If you have Dokploy installed, you can deploy Rote with one click using the template.

1. Access Dokploy: Open your Dokploy management interface
2. Select Template: Find and select the Rote template from the application template list
3. Deploy Application: Click the deploy button, Dokploy will automatically pull the images and start all services
4. Configure Domain (Optional): By default, the deployment uses Dokploy's auto-generated domain. If you need to configure a custom domain for your Rote, remember to set VITE_API_BASE in the environment variables to your domain address (e.g., http://your-domain.com or https://your-domain.com)

### iOS App: Connect to Self-Hosted Backend

The iOS app can connect to your self-hosted backend.

1. On the login page, tap the welcome text at the top multiple times to open the config dialog.
2. Set `API Base` to your public backend URL (or reverse-proxy URL).
3. Continue with the normal login flow.

### Memory

Memory is optional and disabled by default. It is available in the `develop` image and will be available in stable images after the next release that includes Memory. Administrators can enable it from `Admin -> AI Settings` after configuring chat and embedding providers. Rote supports OpenAI-compatible providers, including OpenAI, OpenRouter, Ollama / LM Studio, DeepSeek, SiliconFlow, DashScope / Qwen, Zhipu GLM, Moonshot / Kimi, Volcengine Ark, Tencent Hunyuan, Baidu Qianfan, and custom OpenAI-compatible endpoints.

AI access is controlled by the `ai.chat` permission, which administrators can grant by role or per user. AI conversations stay in the current browser session and are not persisted to the database. Notes and articles are indexed only for users with AI chat permission when AI vector storage and automatic indexing are enabled by an administrator.

### Detailed Instructions

For more deployment options and configuration instructions, please check the documentation in the `doc/` directory:

- [Self-Hosted Deployment Guide](https://rote.ink/doc/selfhosted) - Complete deployment and configuration guide
- [API Documentation](doc/userguide/API-ENDPOINTS.md) - API interface usage guide
- [API Key Guide](doc/userguide/API-KEY-GUIDE.md) - How to use API Key
- [AI Vector Migration Guide](doc/userguide/AI-VECTOR-MIGRATION.zh.md) - Upgrade an existing self-hosted database to Memory and pgvector support (Chinese)
- [User-local AI Guide](doc/userguide/LOCAL-AI.zh.md) - Run Gemma on the user's own computer without sending model requests through the Rote server (Chinese)
- [Rote Pro Billing Integration](doc/paid-subscription-integration.zh.md) - Optional official-instance subscription projection design (Chinese)
- [Rote Pro Server Plan](doc/paid-subscription-plan.zh.md) - Server-side implementation phases and acceptance criteria (Chinese)

### Video Tutorials (Bilibili)

- [Local deployment tutorial](https://www.bilibili.com/video/BV1vc6iBfE1F)
- [Rote deployment via Dokploy](https://www.bilibili.com/video/BV1z96vBeEYr)

### Community Projects

- [Raycast Extension](https://github.com/aBER0724/rote-raycast) - Raycast extension for Rote, developed by [@aBER0724](https://github.com/aBER0724)
- [Rerote](https://github.com/Rabithua/Rerote) - Data conversion tool that transforms data from other platforms (currently Memos) into Rote format
- [Rotefeeder](https://github.com/Rabithua/Rotefeeder) - Deno-based RSS/Atom feeder that periodically forwards feed items to Rote via OpenKey
- [Rote Toolkit](https://github.com/Rabithua/rote-toolkit) - A TypeScript-based enhancement toolkit for Rote, featuring a powerful CLI and a Model Context Protocol (MCP) server for AI integration
- [Rote Skill](https://github.com/Rabithua/rote-skill) - A reusable skill for AI agents to work with Rote through rote-toolkit

## Technology Stack

<img width="866" height="526" alt="technology" src="https://github.com/user-attachments/assets/2be3a73b-467e-4d4b-8d9f-2a129aba4825" />
