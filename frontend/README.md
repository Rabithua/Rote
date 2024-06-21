## Rote_frontend

### 开发环境

```
rabithua@yuchangyedeMacBook-Air app % node -v
v18.16.1
rabithua@yuchangyedeMacBook-Air app % npm -v
9.5.1
```

### 构建镜像

> 本地构建

```
docker build -t roteweb:latest .
```

> 多平台镜像，prisma 不支持 arm/v7，构建并上传 docker，注意替换 username

```
docker buildx build --platform linux/amd64,linux/arm64 -t rabithua/roteweb:latest --push .
```

### TIPS

- 本地开发 servicework webpush 功能需要开启 https，故有`cert.pem`和`key.pem`（不影响正常开发）

### 页面模版

[React + Typescript + Tailwind + React router + React hot toast Here💫 ](https://github.com/Rabithua/React-Templates/tree/React-Typescript-Tailwind-ReactRouter-ReactHotToast)
