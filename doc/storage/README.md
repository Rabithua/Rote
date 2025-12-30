# 存储配置指南

本目录存放 Rote 项目支持的存储服务配置指南。

## 概述

Rote 支持使用 S3 兼容的对象存储服务来存储附件和文件。你可以选择以下任一存储服务：

- **Cloudflare R2** - Cloudflare 的对象存储服务
- **AWS S3** - Amazon Web Services 的对象存储服务
- **Garage** - 自托管的 S3 兼容对象存储服务（推荐用于自托管部署）

## 目录结构

```
doc/storage/
├── README.md        # 本文件
└── garage/          # Garage 自托管存储配置指南
    ├── README.md    # Garage 完整使用文档
    ├── QUICK_START.md  # Garage 快速启动指南
    ├── docker-compose.yml  # Docker Compose 配置模板
    ├── cors-config.json  # CORS 配置模板
    ├── meta/        # 元数据目录（运行时数据，已忽略）
    └── data/        # 数据目录（运行时数据，已忽略）
```

## 存储服务选择

### Cloudflare R2

适合生产环境使用，提供：

- 全球 CDN 加速
- 免费出站流量
- 与 Cloudflare 生态集成

配置方法：在 Rote 管理后台的存储配置中填写 R2 的访问凭证。

### AWS S3

适合已有 AWS 基础设施的用户，提供：

- 高可用性和可靠性
- 丰富的功能选项
- 全球部署

配置方法：在 Rote 管理后台的存储配置中填写 S3 的访问凭证。

### Garage（自托管）

适合自托管用户，提供：

- 完全自主控制
- 无供应商锁定
- 成本可控

详细配置指南请参考：[Garage 快速启动指南](./garage/QUICK_START.md)

## 配置说明

所有存储服务都通过 Rote 管理后台进行配置，需要提供以下信息：

- **Endpoint**: 存储服务的 API 端点
- **Bucket**: 存储桶名称
- **Access Key ID**: 访问密钥 ID
- **Secret Access Key**: 访问密钥
- **Region**: 区域（部分服务可选）
- **URL Prefix**: 公共访问 URL 前缀

## 注意事项

- 存储配置是系统必需配置，未配置存储服务时无法上传附件
- 建议在生产环境使用支持匿名访问的存储服务（如 R2、S3）或配置预签名 URL
- Garage 作为自托管方案，需要自行维护和备份
