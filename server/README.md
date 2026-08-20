# Rote_node Backend

node v18.16.1
npm v9.5.1

## Other Operations

### Unbound attachment cleanup

The resource maintenance worker scans at most 100 unbound attachments per minute after a fixed
seven-day retention period. `UNBOUND_ATTACHMENT_CLEANUP_MODE` defaults to `observe`, which only
logs aggregate candidate counts and declared bytes. Set it to `enforce` only after reviewing those
aggregates; deletion then updates the storage ledger transactionally and uses the cleanup Outbox for
physical object retries.

### Steps after updating schema

```bash
# 生成迁移文件
bun run db:generate

# 应用迁移（开发环境）
bun run db:push

# 或应用迁移文件（生产环境）
bun run db:migrate
```

### Building Images

> Local build

```
docker build -t rotebackend:latest .
```

> Multi-platform image build (supports amd64 and arm64), build and push to docker, remember to replace username

```
docker buildx build --platform linux/amd64,linux/arm64 -t rabithua/rotebackend:latest --push .

docker buildx build --platform linux/amd64,linux/arm64 \
  -t rabithua/rotebackend:latest \
  -t rabithua/rotebackend:0.2.4 \
  --push .
```

## Important Notes

- After the backend container is generated, it will pull npm packages locally, which takes a few minutes. During this time, the backend will be unavailable.
