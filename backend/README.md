# Rote_node Backend

node v18.16.1
npm v9.5.1

## Backend Creation, Database and Initialization

```
npm run mongoInit
```

## Other Operations

### Steps after updating schema.prisma

```
npm run prisma-update
```

### Building Images

> Local build

```
docker build -t rotebackend:latest .
```

> Multi-platform image build (Prisma doesn't support arm/v7), build and push to docker, remember to replace username

```
docker buildx build --platform linux/amd64,linux/arm64 -t rabithua/rotebackend:latest --push .

docker buildx build --platform linux/amd64,linux/arm64 \
  -t rabithua/rotebackend:latest \
  -t rabithua/rotebackend:0.2.3 \
  --push .
```

## Important Notes

- After the backend container is generated, it will pull npm packages locally, which takes a few minutes. During this time, the backend will be unavailable.
