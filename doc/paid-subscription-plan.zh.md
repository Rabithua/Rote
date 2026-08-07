# Rote Server：Rote Pro 实施计划

本文是 Rote 开源仓库的实施清单，只覆盖服务端投影、权限解析和安全限额。Apple 业务状态机在私有 Paid Server 实现。

## 阶段 1：配置、schema 与 contract fixtures

- 增加 billing 类型安全配置；默认 disabled，缺少配置不得影响自托管启动。
- 增加 grant、inbound delivery 和 account event outbox migration；event outbox 不使用删除级联外键。
- 从 Paid 主规范复制无秘密的 HMAC/request/snapshot fixtures，建立双仓 contract tests。
- 建立 billing domain 模块，隔离 route、Paid client、grant repository、signature 和 account-event worker，避免把逻辑塞进通用 utils。

验收：迁移从空库和现有库成功；disabled 配置运行全部现有测试；HMAC fixture 与 Paid 一致。

## 阶段 2：grant callback 与 capability resolver

- 实现 `PUT /internal/billing/grants/:userId` 的 HMAC、时钟、幂等和 schema 校验。
- 事务内比较 bigint revision、写完整 snapshot 和 delivery response；相同 revision 冲突告警。
- `CapabilitySource` 增加 subscription，`EffectiveCapability` 增加可选 `validUntil`。
- 在 `getEffectiveCapabilitiesForUser` 读取有效本地 grant，按 super-admin → override → subscription → role policy/default → dependency 解析。
- subscription 的 lease 缺失、格式错误或过期全部 fail closed；`/permissions/me` 返回 ISO validUntil。

验收：优先级、依赖、lease 边界、重复/乱序 callback 和旧 DTO 兼容测试通过。

## 阶段 3：App billing bridge

- 增加 config、me、session、activate 四个 `/v2/api/billing` route；沿用现有 JWT 和响应包装。
- Paid client 使用 direction-specific active HMAC key，previous 只供接收；配置连接/总超时，生成 UUIDv7 requestId。
- activate 限制 JWS body 大小且不记录 payload；Paid snapshot 在本地成功应用后才返回 200。
- `/billing/me` 只读本地 grant；disabled 和 lease-expired 语义按接入文档固定。

验收：官方/自托管配置、鉴权、错误映射、Paid timeout、本地事务失败和幂等激活均覆盖。

## 阶段 4：账号生命周期 outbox

- 在现有账号 merge/delete 事务中写不可变 outbox，不直接同步 HTTP 调用 Paid。
- worker 多副本安全领取，使用 eventId 作为 HMAC request ID，指数退避并持久化响应。
- delete 确保 outbox 不随用户记录删除；merge source/target 顺序固定并防止空 ID。
- 添加运维查询/重试入口，但不提供绕过签名或删除失败任务的快捷路径。

验收：重复事件、网络中断、worker crash、用户已删除、Paid 401/5xx 和终态 2xx 测试通过。

## 阶段 5：AI 限额

- 在 capability 检查后识别 subscription source，只对该来源执行 Pro 限额。
- 使用共享存储实现滚动 60 秒请求数、带 lease 的 2 并发槽和滚动 24 小时 token ledger。
- 在 provider 调用前完成检查/占位；所有退出路径 finally 释放；usage 可得时写实际 token。
- 429 响应返回稳定 `limitKind`、`retryAfterSeconds` 或 `windowEndsAt`。
- 明确输入、历史和最大输出 token 上限，使最多两个在途请求的超量有界。

验收：多实例并发、边界时间、provider timeout/cancel/error 和槽位回收测试通过。

## 阶段 6：视频 reservation 与容量

- 扩展 presign contract，要求每个逻辑视频附件具有稳定 clientUploadId、类型和预估大小。
- 原子检查 UTC 日 20 次和 10GB committed+reserved，重复 clientUploadId 返回原 reservation。
- finalize 读取对象元数据，用实际字节提交；过期 reservation 和孤儿对象由 worker 清理。
- 定义 batch/Live Photo 计数，以及 original/poster/paired video/static image 分类。
- 只对 subscription source 使用这些保护限额；其他授权来源保持现有管理员语义。

验收：批量、Live Photo、并发 presign、重复/过期 reservation、超预估 actual bytes、删除对象和 UTC 日切通过。

## 阶段 7：联调、可观测性与发布

- 增加 route latency/error、outbox backlog、签名失败、grant lease horizon、AI/video 限额指标；标签不包含用户或交易高基数字段。
- 与 Paid contract suite 联调高/低 revision、callback retry、merge/delete、多订阅聚合和 HMAC 轮换。
- 与 iOS 联调 session、activate 503 后重试、restore、Offer Code 和 transaction finish 时序。
- 先部署 schema/callback（billing disabled），再部署 Paid，最后只对 sandbox allowlist 开启官方实例。

每个代码阶段按仓库规则在 `server/` 运行 `bun run lint`、`bun run build` 及相关测试。任何 DNS、Dokploy、App Store Connect 或生产开关变更必须另获授权。

## 完成定义

- 自托管默认行为和现有 permission API 无回归。
- Paid 故障不进入 AI/视频/permissions 正常请求路径。
- 授权不会越过 24 小时 lease，旧 revision 不覆盖新状态。
- App 激活只有在本地 grant 已提交后成功。
- merge/delete 事件不会因用户删除或进程退出丢失。
- AI/video 限额在多实例和重试下不可绕过。
- 日志、错误和指标不包含完整 JWS、transaction ID、email、JWT 或 HMAC secret。
