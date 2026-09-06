# 旧版线上数据库迁移到 AI Vector 特性指南

本文档面向已经在线上运行 Rote 的自托管实例，说明如何从旧版普通 PostgreSQL 数据库升级到支持记忆、语义搜索和 pgvector 的新版。

新版会新增 `document_embeddings` 和 `embedding_jobs` 两张表。原有笔记、文章、用户、配置等业务数据不会被重写。AI、向量存储和公开 Explore 语义检索默认关闭，必须由管理员在后台显式开启。

## 适用范围

适用于以下场景：

- 旧版使用 `docker-compose.yml` 或 `docker-compose.build.yml` 部署。
- 数据库容器原来使用 `postgres:17` 或旧版 compose 默认 PostgreSQL 镜像。
- 希望升级到新版记忆、相关笔记、语义搜索、RAG 对话能力。

不适用于 PostgreSQL 大版本迁移。本文默认旧库和新库都保持 PostgreSQL 17。不要在同一个数据卷上跨 PostgreSQL 大版本直接换镜像。

## 升级原则

1. 先备份，再升级。
2. 保持 `POSTGRES_PASSWORD`、数据库卷名和 PostgreSQL 大版本不变。
3. 将 PostgreSQL 镜像切到带 pgvector 扩展的镜像，例如 `pgvector/pgvector:pg17-trixie`。
4. 先让新版后端执行数据库迁移，再在 Admin 后台启用 AI 与向量能力。
5. 存量数据不会自动全部向量化，需要管理员明确启动重建。

## 迁移前检查

在服务器上确认当前服务和数据库状态：

```bash
docker compose ps
docker logs --tail=100 rote-backend
docker logs --tail=100 rote-postgres
```

确认 PostgreSQL 大版本：

```bash
docker exec rote-postgres psql -U rote -d rote -c "select version();"
```

确认基础数据量，便于迁移后对照：

```bash
docker exec rote-postgres psql -U rote -d rote -c "select count(*) as rotes from rotes;"
docker exec rote-postgres psql -U rote -d rote -c "select count(*) as articles from articles;"
docker exec rote-postgres psql -U rote -d rote -c "select count(*) as users from users;"
```

如果你使用的不是默认容器名，请把命令中的 `rote-postgres` 替换为实际数据库容器名。

## 备份数据库

升级前至少做一次数据库逻辑备份：

```bash
docker exec rote-postgres pg_dump -U rote -d rote > rote_before_vector_$(date +%Y%m%d_%H%M%S).sql
```

如果数据量较大，可以使用 custom 格式备份：

```bash
docker exec rote-postgres pg_dump -U rote -d rote --format=custom > rote_before_vector_$(date +%Y%m%d_%H%M%S).dump
```

如果你还希望做 Docker volume 级别备份，请先停止服务，避免复制过程中数据仍在写入：

```bash
docker compose stop rote-backend rote-frontend rote-postgres
docker run --rm \
  -v rote-postgres-data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/rote-postgres-data_before_vector_$(date +%Y%m%d_%H%M%S).tgz -C /data .
```

注意：不要执行 `docker compose down -v`。`-v` 会删除数据库卷。

## 更新 compose 配置

新版 compose 已支持 `POSTGRES_IMAGE`：

```yaml
image: ${POSTGRES_IMAGE:-pgvector/pgvector:pg17-trixie}
```

推荐在 `.env` 或启动命令中设置：

```bash
POSTGRES_IMAGE=pgvector/pgvector:pg17-trixie
IMAGE_TAG=<new-rote-version>
VITE_API_BASE=https://your-api-domain.com
POSTGRES_PASSWORD=<keep-your-existing-password>
```

关键点：

- `POSTGRES_PASSWORD` 必须继续使用旧实例的数据库密码。
- 如果你复制新版 `docker-compose.yml`，请同步保留旧实例的域名、端口、密码和其他自定义配置。
- 如果暂时不想启用 AI Vector，也可以继续设置 `POSTGRES_IMAGE=postgres:17`，但 pgvector 检测会显示不可用，AI 语义能力无法启用。

## 启动新版服务并执行迁移

拉取新镜像：

```bash
docker compose pull
```

先启动数据库，确认 pgvector 扩展可用：

```bash
docker compose up -d rote-postgres
docker exec rote-postgres psql -U rote -d rote -c "select name, default_version from pg_available_extensions where name = 'vector';"
```

如果能查到 `vector`，说明当前 PostgreSQL 镜像支持 pgvector。

启动完整服务：

```bash
docker compose up -d
```

后端启动命令会自动执行迁移：

```bash
docker logs -f rote-backend
```

迁移完成后检查新增表：

```bash
docker exec rote-postgres psql -U rote -d rote -c "select to_regclass('public.document_embeddings'), to_regclass('public.embedding_jobs');"
```

预期能看到两张表都存在。

## 启用 pgvector 与 AI 设置

数据库迁移完成后，进入 Rote 管理后台：

1. 打开 `管理`。
2. 进入 `AI 相关`。
3. 配置 Chat Provider 和 Embedding Provider。
4. 分别测试 Chat 与 Embedding 连接。
5. 开启 `启用 AI`。
6. 开启 `启用向量存储`。
7. 点击 `启用 pgvector`。

`启用 pgvector` 会执行：

- `CREATE EXTENSION IF NOT EXISTS vector`

保存并验证模型后，“重建向量索引”会按实际维度和新代次创建 HNSW 索引。

可以用 SQL 检查扩展与索引：

```bash
docker exec rote-postgres psql -U rote -d rote -c "select extname, extversion from pg_extension where extname = 'vector';"
docker exec rote-postgres psql -U rote -d rote -c "select indexname from pg_indexes where tablename = 'document_embeddings' and indexname like 'embedding_%_idx';"
```

修改模型输出设置后，保存配置并明确启动重建。无需重新安装扩展。

## 向量化存量数据

迁移只会创建表结构，不会立即把所有历史笔记和文章向量化。管理员需要在 `AI 相关` 页面执行：

1. 保存并验证配置后，点击 `重建向量索引`，确认模型调用费用。
2. 观察任务统计中的 pending/running/succeeded/failed。
3. 等待后台 worker 自动处理，或点击 `立即处理`。

后台 worker 每 30 秒会尝试处理一批待处理任务。也可以用 SQL 查看进度：

```bash
docker exec rote-postgres psql -U rote -d rote -c "select status, count(*) from embedding_jobs group by status order by status;"
docker exec rote-postgres psql -U rote -d rote -c "select count(*) as embeddings from document_embeddings;"
```

如果有失败任务：

1. 先检查模型供应商、API Key、Base URL、embedding dimensions 是否正确。
2. 修复配置后点击 `重试失败任务`。
3. 再点击 `立即处理`，或等待 worker 自动处理。

如需重新构建，请使用 `重建向量索引`；历史向量会保留。只有确实需要删除全部代次数据时才执行 `清空索引`，该操作不会删除原始笔记或文章。

## 迁移后验证

完成 backfill 后建议验证以下功能：

- Admin `AI 相关` 页面显示 pgvector 已就绪。
- 任务统计中 `failed` 为 0，或失败原因已知。
- `/ai` 页面可以正常提问，并展示来源。
- 笔记详情页能显示相关笔记。
- `/filter` 的语义搜索模式能返回结果。
- 普通关键词搜索、创建笔记、编辑笔记、删除笔记仍正常。

也可以检查 AI 状态接口，确认它不会返回 provider secret 或 API Key：

```bash
curl -H "Authorization: Bearer <your-token>" \
  https://your-api-domain.com/v2/api/ai/status
```

## 使用外部托管数据库

如果你使用的是 RDS、Supabase、Neon 或其他托管 PostgreSQL，而不是 compose 内置数据库：

1. 确认服务商支持 pgvector。
2. 确认当前数据库用户有权限创建扩展，或在服务商控制台启用扩展。
3. 执行或让管理员后台执行：

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. 确认 `pg_available_extensions` 能查到 `vector`。

如果托管数据库不支持 pgvector，可以继续使用普通数据库运行 Rote，但不要开启向量存储；AI 语义搜索、相关笔记和 RAG 对话将不可用。

## 回滚建议

如果新版应用启动失败，但数据库迁移尚未执行成功：

1. 将 `IMAGE_TAG` 改回旧版本。
2. 保持 `POSTGRES_IMAGE=pgvector/pgvector:pg17-trixie` 或旧的 `postgres:17`。
3. 执行 `docker compose up -d`。

如果已经执行了 `CREATE EXTENSION vector` 或创建了向量索引，回滚旧应用时建议继续使用 `pgvector/pgvector:pg17-trixie` 作为数据库镜像。它仍然是 PostgreSQL 17，只是额外带有 vector 扩展。不要在已经安装 vector 扩展的数据卷上直接切回不带扩展库的普通 `postgres:17` 镜像，否则可能遇到类似 `could not access file "$libdir/vector"` 的错误。

如果必须回到完全旧版数据库状态，请从升级前备份恢复到新的空数据库卷：

```bash
docker compose down
# 确认你真的要替换数据库卷后，再删除旧卷或换用新卷名。
# 不确定时不要执行 docker volume rm。
docker compose up -d rote-postgres
docker exec -i rote-postgres psql -U rote -d rote < rote_before_vector_YYYYMMDD_HHMMSS.sql
```

custom 格式备份可以用：

```bash
docker exec -i rote-postgres pg_restore -U rote -d rote --clean --if-exists < rote_before_vector_YYYYMMDD_HHMMSS.dump
```

## 常见问题

### pgvector extension is not available in this Postgres image

当前数据库镜像不包含 pgvector。请确认 `POSTGRES_IMAGE` 已设置为 `pgvector/pgvector:pg17-trixie`，并重新启动数据库容器。

### could not access file "$libdir/vector"

数据库里已经安装过 vector 扩展，但当前运行的 PostgreSQL 镜像没有 vector 扩展库。请切回 `pgvector/pgvector:pg17-trixie`，或从升级前备份恢复到普通 PostgreSQL 数据库。

### Embedding dimensions mismatch

模型实际输出与指定维度或已验证维度不一致。请检查模型能力，选择默认输出或模型支持的指定维度，保存验证后明确启动重建。

### 模型测试成功，但保存配置失败

从 Prisma 时期保留的旧数据库可能缺少 `settings.updatedAt` 的数据库默认值。模型测试不写配置，因此可以成功；保存、暂停或恢复队列时，PostgreSQL 会在 upsert 冲突处理前因非空约束拒绝写入。

正式迁移 `0032_settings_updated_at_default` 将该字段默认值补齐为 `now()`，与当前 Drizzle schema 一致，不重写已有配置或向量。更新后端并完成正常数据库迁移后即可再次保存，无需修改模型或清空数据库。该迁移不调用模型，也不启动索引重建。

数据库写入失败时，接口返回 HTTP 500、非零 `code` 和 `embedding_settings_save_failed`，原配置及索引状态保持不变；`data.databaseCode` 和服务端日志中的 SQLSTATE 可用于定位故障，响应与日志不会包含这次配置写入的 SQL 参数。

### backfill 很慢

存量笔记多、文章长、模型供应商速率限制较低时，重建会比较慢。可以保持站点正常使用，让后台 worker 处理；重建期间创建或编辑的内容会通过数据库变更事件进入任务队列，即使日常自动索引关闭。

### 语义搜索没有结果

按顺序检查：

1. AI 是否已启用。
2. 向量存储是否已启用。
3. pgvector 是否已启用并有索引。
4. `embedding_jobs` 是否还有大量 pending 或 failed。
5. `document_embeddings` 是否有数据。
6. 当前用户是否有对应内容的访问权限。



## 向量模型契约升级（Issue #318）

升级到本次版本会执行正式数据库迁移。原有笔记、文章和向量记录都会保留；历史向量没有可靠的供应商配置标识，因此不会自动归入新的索引。迁移不调用模型，不安装 pgvector，不启动全量重建。

升级后向量检索暂停，普通聊天仍可使用。管理员需要：

1. 打开管理后台的 AI 配置。旧的维度设置会保留为“指定输出维度”，以保留原有降维意图。
2. 对 BGE-M3 等固定维度模型选择“使用模型默认维度”，再测试连接。硅基流动的 `BAAI/bge-m3` 应返回 1024 维，原生模式不会发送 `dimensions` 参数。
3. 只有需要并支持指定输出维度的模型才使用指定模式。当前全精度 HNSW 索引支持整数 1–2000 维；模型返回更高维度时需要配置模型支持的较小输出，系统不会截断向量。
4. 保存配置。启用向量功能时，后端会实际验证模型响应，测试成功不等于已经保存。验证失败不会覆盖原配置。
5. 如有需要，使用“启用 pgvector”安装扩展。这个动作不再创建未验证维度的索引。
6. 点击“重建向量索引”，确认检索暂停和模型调用费用后启动。重建完成后自动恢复向量检索。

更换供应商、地址、模型、输出模式或分块配置会要求新一轮重建。API Key 轮换需要验证，但输出契约一致时无需重建。多个管理员同时修改配置时，旧版本保存会返回冲突，刷新后再编辑。

重建进度保存在数据库中，服务重启后继续处理。重建期间新增和修改的内容也会被处理，即使日常自动索引关闭。暂停队列会停止扫描和领取新任务；已经执行的请求可完成。失败任务显示失败状态，修复配置或供应商问题后重试；参数和向量格式错误不会自动更改参数重试。

旧向量保留用于追溯，不参与当前检索。明确执行“清空索引”会删除所有代次向量和队列任务，并要求重建。切勿通过回退应用版本直接使用升级后的数据库；如需整体回滚，应同时恢复升级前的应用版本和数据库备份。

### 管理接口变化

- AI 配置为 `schemaVersion: 2`，包含服务端返回的 `revision`。保存必须携带当前版本。
- `embedding.output` 为 `{ "mode": "native" }` 或 `{ "mode": "dimensions", "dimensions": 1024 }`。旧的 `embedding.dimensions` 不再接受写入。
- `POST /v2/api/ai/test` 的向量结果包含实际维度、输出模式和数据库准备状态，不产生配置写入。
- `POST /v2/api/ai/index/rebuild` 接收 `{ "revision": 1 }`，返回 HTTP 202 和持久化重建状态；重复请求同一轮重建不会重复启动。
- `/v2/api/ai/vector/status` 返回当前代次、维度、配置版本、状态、错误码及 `ready`。`ready` 为真才表示向量检索已准备好。
- 错误继续采用 `{ code, message, data }` 响应格式；`message` 为 `embedding_*` 错误码，`data` 提供相关数值和供应商 HTTP 状态，不返回原始供应商响应或认证信息。
