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

grant 表应随本地用户删除而删除；Paid 不参与删除事务，并在下一次 lease refresh callback 收到 404 后自行转为 orphaned。

### `billing_inbound_deliveries`

保存 HMAC `deliveryId`、keyId、body hash 和最终响应，用于重放防护。相同 ID/相同 body 返回保存的响应；相同 ID/不同 body 返回 409。记录至少保留 24 小时，grant revision 继续提供永久顺序保护。

### 安全限额数据

- AI 使用共享存储保存滚动分钟请求计数、UTC 日请求计数和带过期时间的并发 lease；多实例部署不得使用纯内存计数。
- v1 不创建 token ledger、视频 quota/reservation 表，也不为了订阅限额扩展客户端上传协议。
- 视频数量和存储增长从现有 finalized 附件数据聚合为运维指标，不作为 v1 用户级计费账本。

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

Rote 发送请求和接收 callback 必须复用同一经过 fixture 验证的 canonicalization 实现。时间偏差最大 300 秒。body 的 `requestId` 或 `deliveryId` 必须等于 header request ID。比较签名使用 constant-time API。幂等唯一键是方向 + request/delivery ID，不能包含 keyId；keyId 只作审计，避免轮换时重复执行。

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

目标用户不存在时，无论 snapshot 是否为空都返回标准 JSON 404，message 固定为 `billing_grant_user_not_found`。Paid 只把该结构化错误解释为账号已删除；反向代理/未知格式 404 不得触发 orphaned。Rote 不发送专用删除事件。

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
- 每个 UTC 自然日最多 100 次实际发送给模型 provider 的请求。

开始模型调用前按以下顺序原子执行：

1. 清理过期并发 lease，获取一个最长覆盖请求 timeout 的槽。
2. 在共享存储中检查分钟和 UTC 日计数；只有即将实际 dispatch 的请求才递增日计数。
3. 继续应用现有模型上下文、输入和最大输出限制，不另建订阅 token 预算。
4. 在 finally 释放并发槽；provider timeout、取消和异常退出同样释放。

达到限制返回 HTTP 429、`billing_safety_limit_reached`，data 包含稳定 `limitKind` 和适用的 `retryAfterSeconds`/`resetAt`。不提供 token 余额或用量仪表盘。服务端另保留全局 AI 紧急关闭开关，成本通过 provider 预算/告警和低基数服务指标监控。

## 9. 视频 v1 最小保护

v1 不实现订阅专用的 20 次/日、10GB 用户容量、presign reservation、Live Photo 计费分类或新的 `clientUploadId` 协议。视频上传：

- 继续服从现有单文件大小、文件类型、对象存在性和附件安全校验。
- 从现有 finalized 附件记录采集视频数量、字节和存储增长指标，不新增用户配额账本。
- 配置全局紧急停用能力，并对存储增长和对象存储成本设置运维告警。
- 停用或存储故障使用现有服务可用性错误语义，不返回暗示用户需要再次购买的限额/paywall 错误。

先观察真实用量、成本和滥用分布；只有数据证明现有保护不足时，才另行设计用户级次数/容量限制。该延期决策不得被实现阶段自行替换为临时 quota 表。

## 10. 账号生命周期

- v1 不实现 Paid account event outbox、订阅账号 alias、自动转移或删除后的自动重新认领。
- 账号 merge 开始前只读 source/target 的本地 billing grant；任一账号最后状态为 active、grace_period 或 lease-expired `unavailable` 时返回 409 `billing_account_operation_requires_support`，不执行自动合并。只有明确 `none` 时沿用现有 merge。
- 账号删除不依赖 Paid 可用性：正常删除用户，本地 billing grant 随用户删除。下一次 Paid 定期续租 callback 得到 404 后会把映射标记 orphaned。
- Rote 不自行解释 Apple transaction，也不直接移动订阅归属；orphaned 订阅不迁移，支持只提供原账号、取消或退款指引。

## 11. 错误与故障语义

| HTTP | message | 行为 |
| --- | --- | --- |
| 403 | `billing_not_configured` | 不展示/不重试购买入口 |
| 503 | `billing_provider_unavailable` | 保留 StoreKit transaction，稍后重试 |
| 400 | `billing_invalid_transaction` | 停止自动重试并展示支持入口 |
| 403 | `billing_environment_not_allowed` | Sandbox 非 allowlist |
| 409 | `billing_subscription_owned_by_another_account` | 展示账号归属提示 |
| 409 | `billing_account_operation_requires_support` | 有有效订阅的账号不支持自动合并 |
| 429 | `billing_safety_limit_reached` | AI 基础防滥用触发，按返回时间重试 |

内部 callback 的 `billing_grant_user_not_found` 不返回给 App。

原有能力不足错误继续为 `capability_required:<capability>`。

## 12. 验收场景

- billing disabled 时现有登录、权限、AI 和上传测试无变化。
- callback 的高/低/相同 revision、相同 revision 冲突、HMAC active/previous、过期和重放。
- `/billing/me` 在 lease 到期时本地失效，Paid 故障不阻塞读取。
- 激活本地写失败返回 503，后续 callback 可恢复。
- override deny 高于 subscription；dependency 能关闭 video；subscription validUntil 缺失/损坏/过期 fail closed。
- AI 多实例分钟/日计数、并发 lease、异常 finally 释放和紧急开关。
- 视频沿用现有上传校验，finalized 用量指标和全局停用不会引导用户再次购买。
- 有 active/grace 订阅的账号 merge 被阻止；账号删除不调用 Paid，grant cascade 删除，下一次 callback 404。
