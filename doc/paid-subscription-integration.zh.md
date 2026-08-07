# Rote Pro 订阅服务端接入设计

本文只定义开源 Rote Server 的实现边界。Apple 订阅验证、归属、通知和运行规则的权威规范位于私有 `Rabithua/RotePaidServer`；若两者冲突，先修订主规范，再同步本文。

## 1. 设计边界

Rote Server 仍是唯一 capability 判定方。Paid Server 只把 Apple 订阅转换为最长 24 小时的授权快照；AI、附件和 `/permissions/me` 不实时请求 Paid Server。

- 未配置 Paid Server 的自托管实例行为完全不变。
- v1 只有官方 origin `https://api.rote.ink` 启用购买桥接。
- Web v1 不提供购买页；它只消费与 iOS 相同的服务端 capability 结果。
- 客户端 StoreKit 状态不能绕过 Rote capability middleware。

## 2. 配置

建议新增类型安全配置：

```text
BILLING_ENABLED=false
BILLING_INSTANCE_ID=rote-official
BILLING_OFFICIAL_ORIGIN=https://api.rote.ink
BILLING_PAID_SERVER_URL=https://billing.rote.ink
BILLING_PRODUCT_IDS=ink.rote.pro.monthly,ink.rote.pro.yearly
BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID=<id>
BILLING_ROTE_TO_PAID_ACTIVE_SECRET=<secret>
BILLING_ROTE_TO_PAID_PREVIOUS_KEY_ID=<optional>
BILLING_ROTE_TO_PAID_PREVIOUS_SECRET=<optional>
BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID=<id>
BILLING_PAID_TO_ROTE_ACTIVE_SECRET=<secret>
BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID=<optional>
BILLING_PAID_TO_ROTE_PREVIOUS_SECRET=<optional>
```

约束：

- `BILLING_ENABLED=false` 时不得要求任何 Paid 配置，四个公开 billing endpoint 中 config 返回 disabled，其余返回 `billing_not_configured`。
- enabled 时 origin 必须是精确 HTTPS URL，Paid URL 不得暴露给客户端。
- 发送/接收 secret 必须不同，active/previous 必须成对配置。
- Product ID 必须属于编译期允许集合，不能仅信任环境变量。

## 3. 本地数据

### `billing_grants`

每个 Rote user 保留一份完整投影：

- `user_id` 唯一。
- `issuer`、`instance_id`。
- `revision bigint`；API JSON 使用十进制字符串。
- `plan_id`、`status`、`product_id`。
- `entitlement_expires_at`、`lease_expires_at`。
- `capabilities jsonb`，写入前只接受已知 capability。
- `snapshot_hash`、`updated_at`。

callback 应在数据库事务中比较 revision 并完整 upsert：

- 更高 revision：应用。
- 更低 revision：200 ignored。
- 相同 revision/相同 hash：200 duplicate。
- 相同 revision/不同 hash：409 并告警。

grant 表可以引用用户，但删除流程不能依靠 cascade 撤销 Paid 状态。

### `billing_inbound_deliveries`

保存 HMAC `deliveryId`、keyId、body hash 和最终响应，用于重放防护。相同 ID/相同 body 返回保存的响应；相同 ID/不同 body 返回 409。记录至少保留 24 小时，grant revision 继续提供永久顺序保护。

### `billing_account_event_outbox`

账号 merge/delete 需要 Rote→Paid 的 durable outbox，不能在用户事务后 fire-and-forget：

- 保存不可变 `eventId`、event type、source/target userId、occurredAt、payload、attempt 和 nextAttemptAt。
- 不使用随 `users` 删除而 cascade 的外键。
- 账号事务内先写 outbox，再完成 delete；worker 使用 HMAC 投递 `account-events`。
- 重试直到 Paid 返回 2xx/幂等成功；401/403 立即告警。

### 安全限额数据

- AI 使用分布式速率计数、并发 lease 和滚动 token ledger；多实例部署不得使用纯内存计数。
- 视频使用 `(user_id, client_upload_id)` 唯一 reservation，包含逻辑视频数、预估字节、过期时间和 committed 状态。
- finalized 附件的计费字段必须能区分视频原件、poster、Live Photo 配对视频和静态图。

## 4. HMAC 协议

请求头：

```http
X-Rote-Key-Id: <key-id>
X-Rote-Timestamp: <unix-seconds>
X-Rote-Request-Id: <UUIDv7>
X-Rote-Signature: v1=<lowercase-hex-hmac-sha256>
```

canonical string 固定为：

```text
v1
<UPPERCASE_METHOD>
<path-and-canonical-query>
<unix-seconds>
<request-id>
<lowercase-hex-sha256-of-exact-body-bytes>
```

Rote 发送请求和接收 callback 必须复用同一经过 fixture 验证的 canonicalization 实现。时间偏差最大 300 秒。body 的 `requestId`、`eventId` 或 `deliveryId` 必须等于 header request ID。比较签名使用 constant-time API。

轮换时接收端同时接受 active/previous keyId，发送端只使用 active；排空后移除 previous。日志不得包含 secret、签名、Authorization、完整 JWS 或完整交易 ID。

## 5. 对 App API

路径均位于 `/v2/api`，沿用 `{ code, message, data }`。

### `GET /billing/config`

无需登录，只读本地配置：

```json
{
  "enabled": true,
  "officialOrigin": "https://api.rote.ink",
  "products": ["ink.rote.pro.monthly", "ink.rote.pro.yearly"],
  "features": { "offerCode": true, "promotedPurchases": false }
}
```

disabled 时仍返回 200 和 `enabled: false`。不得返回 Paid URL、keyId 或 Sandbox allowlist。

### `GET /billing/me`

要求登录，只读 `billing_grants`。响应字段：

```json
{
  "planId": "rote_pro",
  "status": "active",
  "productId": "ink.rote.pro.yearly",
  "entitlementExpiresAt": "2027-08-07T00:00:00.000Z",
  "leaseExpiresAt": "2026-08-08T00:00:00.000Z",
  "capabilities": ["ai.chat", "attachment.video.upload"]
}
```

本地时间不早于 lease 时返回 `status: unavailable` 和空 capabilities；不得为了刷新页面同步查询 Paid。无记录返回 `status: none`。

### `POST /billing/app-store/session`

要求登录，body 为 `{}`。Rote 生成 UUIDv7 requestId，以当前 JWT userId 调用 Paid `POST /v1/rote/accounts/session`，返回 appAccountToken 和本地 allowlist Product ID。

### `POST /billing/app-store/activate`

要求登录：

```json
{ "signedTransactionInfo": "<JWS>" }
```

- 设置严格 body 长度上限；不解析或记录完整 JWS。
- 生成 requestId 调用 Paid `POST /v1/rote/app-store/activate`。
- 在事务中按更高 revision 应用返回 snapshot，成功后才向 App 返回 200。
- Paid 已成功而本地写入失败时返回 503 `billing_provider_unavailable`；App 保持 transaction unfinished，Paid outbox 后续修复。

## 6. Paid callback

### `PUT /internal/billing/grants/:userId`

该路由不接受 Rote JWT，只接受 Paid→Rote HMAC。body：

```json
{
  "deliveryId": "UUIDv7",
  "issuer": "rote-paid-server",
  "instanceId": "rote-official",
  "revision": "42",
  "planId": "rote_pro",
  "status": "active",
  "productId": "ink.rote.pro.yearly",
  "entitlementExpiresAt": "2027-08-07T00:00:00.000Z",
  "leaseExpiresAt": "2026-08-08T00:00:00.000Z",
  "capabilities": ["ai.chat", "attachment.video.upload"]
}
```

验证 issuer/instance、revision 格式、ISO 日期、`leaseExpiresAt <= entitlementExpiresAt` 和 capability allowlist。撤销 snapshot 使用 `status: none`、null product/expiry、空 capabilities。

用户在 merge/delete 后不存在时，只有空 snapshot callback 才返回 404；非空 snapshot 返回 409 并告警，防止授权投向未知用户。

## 7. capability 解析

现有类型增加：

```ts
type CapabilitySource =
  | 'user_override'
  | 'subscription'
  | 'role_policy'
  | 'role_default'
  | 'dependency';

type EffectiveCapability = {
  allowed: boolean;
  source: CapabilitySource;
  role: string;
  validUntil?: string;
};
```

优先级：

1. super-admin。
2. 有效 user override，包括 deny。
3. 本地有效 subscription grant。
4. role policy。
5. role default。
6. dependency 后处理。

subscription 只有在 status active/grace、lease 晚于当前时间且包含 capability 时参与。subscription source 的 `validUntil` 必须等于 leaseExpiresAt；缺失、无效或已过期按 deny。其他 source 不要求该字段，保证旧客户端兼容。

Rote Pro 直接授予 `ai.chat`、`attachment.video.upload`；视频最终仍要求 dependency `attachment.upload`。管理员 user override deny 能压过订阅。

## 8. AI 安全限额

仅对由 `subscription` 解锁的普通用户应用 Rote Pro 保护限额；super-admin、管理员明确 override 和自托管 role policy 沿用原配置，避免订阅功能改变开源实例管理语义。

- 10 次请求/滚动 60 秒。
- 2 个同时执行的模型生成。
- 200,000 token/滚动 24 小时。

开始模型调用前按以下顺序原子执行：

1. 检查并占用一分钟请求计数。
2. 清理过期并发 lease，获取一个最长覆盖请求 timeout 的槽。
3. 汇总 token ledger；已达到 200,000 时拒绝。
4. 对输入、历史和最大输出使用服务端硬上限。
5. 在 finally 释放并发槽；成功/已得到 provider usage 的失败请求写实际 token。

达到限制返回 HTTP 429、`billing_safety_limit_reached`，data 包含 `limitKind`、`retryAfterSeconds`/`windowEndsAt`。两个已开始的请求可以造成有限超量，除此之外不能先放行再异步统计。

## 9. 视频安全限额

同样仅对 subscription 来源应用：

- 视频相关已提交对象总计 10GB。
- UTC 自然日最多 20 个逻辑视频附件。
- 一个 Live Photo 配对视频计 1；批量请求按逻辑视频元素数计，不按 HTTP 次数计。

presign 流程：

1. 客户端为每个逻辑附件发送稳定 `clientUploadId`、类型和预估字节。
2. Rote 在事务中计算 committed + 未过期 reserved 次数/容量，创建短期 reservation。
3. 相同 `(userId, clientUploadId)` 重试返回同一 reservation，不重复占额。
4. finalize 验证对象元数据，原子将 reservation committed，并以实际字节更新用量。
5. 未 finalize reservation 到期释放；对象清理任务处理已上传但未提交的孤儿。

10GB 包含视频原件、视频 poster、Live Photo 配对视频；Live Photo 静态图片按普通附件存储，不计视频容量。失败返回 429 同一错误码和 `limitKind`、`resetAt`/支持信息，不实现额度 dashboard。

## 10. 账号生命周期

- merge 用户事务写入 `account.merged` outbox，包含 source/target；Paid 回调空 source grant 和聚合 target grant。
- delete 在用户记录消失前写 `account.deleted` outbox；事件记录不得被 cascade。
- worker 重试使用同一 eventId，Paid 幂等处理。
- 删除后 source 的空 grant callback 404 是预期终态；非空授权 404 不是成功。
- Rote 不自行解释 Apple transaction，也不直接移动订阅归属。

## 11. 错误与故障语义

| HTTP | message | 行为 |
| --- | --- | --- |
| 403 | `billing_not_configured` | 不展示/不重试购买入口 |
| 503 | `billing_provider_unavailable` | 保留 StoreKit transaction，稍后重试 |
| 400 | `billing_invalid_transaction` | 停止自动重试并展示支持入口 |
| 403 | `billing_environment_not_allowed` | Sandbox 非 allowlist |
| 409 | `billing_subscription_owned_by_another_account` | 展示账号归属提示 |
| 429 | `billing_safety_limit_reached` | 按返回时间重试 |

原有能力不足错误继续为 `capability_required:<capability>`。

## 12. 验收场景

- billing disabled 时现有登录、权限、AI 和上传测试无变化。
- callback 的高/低/相同 revision、相同 revision 冲突、HMAC active/previous、过期和重放。
- `/billing/me` 在 lease 到期时本地失效，Paid 故障不阻塞读取。
- 激活本地写失败返回 503，后续 callback 可恢复。
- override deny 高于 subscription；dependency 能关闭 video；subscription validUntil 缺失/损坏/过期 fail closed。
- AI 多实例速率、并发、token 边界和异常 finally 释放。
- 视频 batch、Live Photo、重复 presign、放弃 reservation、actual bytes 和 UTC 日切。
- merge/delete outbox 在用户删除和 worker 重启后仍可送达。
