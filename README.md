<p align="right">English | <a href="doc/README.zh.md">中文</a></p>

![Group 1](https://github.com/Rabithua/Rote/assets/34543831/a06d5a5b-0580-4138-9282-449a725cd287)

> Open API, more than one way to record 🤩, supports Self-Hosted, take control of your own data, come and go freely, no data hostage 🙅🏻

### Preview

![Rote Preview](doc/assets/imgs/github_preview_img.png)

**[Demo](https://demo.rote.ink/)** ｜ **[Website](https://beta.rote.ink)** ｜ **[iOS APP](https://apps.apple.com/us/app/rote/id6755513897)** ｜ **[Explore](https://beta.rote.ink/explore)** ｜ **[Rabithua](https://beta.rote.ink/rabithua)**

### Core Features

- **Stay Restrained**: Everything for an elegant note-taking experience and restrained interaction
- **Low Mental Burden**: Less pressure and simpler, more intuitive recording experience, even deployment experience
- **Open Interface**: Open API interface, supports recording or getting data in any scenario
- **Unbounded Freedom**: Complete control over your data, free to export data
- **Self-Hosted Deployment**: One-click deployment using Docker or Dokploy
- **Separated Architecture**: Frontend and backend use separated architecture design, deploy only the services you need
- **iOS Client**: More elegant App client (available outside China)

### Quick Start

#### Method 1: Using Docker Hub Image

Copy `docker-compose.yml` to your server with Docker and Docker Compose installed

> Note: If you use a reverse proxy, VITE_API_BASE should be your backend address after the reverse proxy

```bash
# Use latest version (default config file)
VITE_API_BASE=http://<your-ip-address>:18000 docker-compose up -d

# Use specific version
IMAGE_TAG=v1.0.0 docker-compose up -d
```

#### Method 2: Using Dokploy (Recommended)

Dokploy is an open-source Docker deployment platform that provides a visual interface for application deployment and management. If you have Dokploy installed, you can deploy Rote with one click using the template.

1. Access Dokploy: Open your Dokploy management interface
2. Select Template: Find and select the Rote template from the application template list
3. Deploy Application: Click the deploy button, Dokploy will automatically pull the images and start all services
4. Configure Domain (Optional): By default, the deployment uses Dokploy's auto-generated domain. If you need to configure a custom domain for your Rote, remember to set VITE_API_BASE in the environment variables to your domain address (e.g., http://your-domain.com or https://your-domain.com)

### Detailed Instructions

For more deployment options and configuration instructions, please check the documentation in the `doc/` directory:

- [Self-Hosted Deployment Guide](https://beta.rote.ink/doc/selfhosted) - Complete deployment and configuration guide
- [API Documentation](doc/userguide/API-ENDPOINTS.md) - API interface usage guide
- [API Key Guide](doc/userguide/API-KEY-GUIDE.md) - How to use API Key

## Technology Stack

<img width="866" height="526" alt="technology" src="https://github.com/user-attachments/assets/2be3a73b-467e-4d4b-8d9f-2a129aba4825" />
