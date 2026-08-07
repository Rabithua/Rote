# Rote Server：Rote Pro 实施计划

本文是 Rote 开源仓库的实施清单，只覆盖服务端投影、权限解析和 v1 最小安全保护。Apple 业务状态机在私有 Paid Server 实现。

## 阶段 1：配置、schema 与 contract fixtures

- 增加 billing 类型安全配置；默认 disabled，缺少配置不得影响自托管启动。
- 增加 grant 和 inbound delivery migration；grant 随本地用户删除，不增加 account event outbox。
- 从 Paid 主规范复制无秘密的 HMAC/request/snapshot fixtures，建立双仓 contract tests。
- 建立 billing domain 模块，隔离 route、Paid client、grant repository 和 signature，避免把逻辑塞进通用 utils。

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

## 阶段 4：最小账号生命周期

- 不实现 Rote→Paid account event、merge outbox、alias 或自动订阅迁移。
- merge 前检查 source/target 本地 grant；状态为 active、grace_period 或 lease-expired unavailable 时返回 `billing_account_operation_requires_support`，只有明确 none 才沿用现有流程。
- delete 保持现有可用性，不同步调用 Paid；用户和本地 grant 正常删除。
- callback 对不存在用户统一返回结构化 404 `billing_grant_user_not_found`，由 Paid 进入 orphaned 终态；普通代理 404 不得使用该 message。

验收：无订阅 merge 不受影响；有订阅 merge 被阻止；Paid 不可用不阻止立即删除；删除后 callback 稳定返回 404。

## 阶段 5：AI 限额

- 在 capability 检查后识别 subscription source，只对该来源执行 Pro 限额。
- 使用共享存储实现滚动 60 秒最多 10 次、带 lease 的 2 并发槽和 UTC 自然日最多 100 次 provider dispatch。
- 在 provider 调用前完成检查；只有即将实际 dispatch 的请求才占用日计数，所有退出路径 finally 释放并发 lease。
- 429 响应返回稳定 `limitKind`、`retryAfterSeconds` 或 `resetAt`。
- 复用现有模型上下文和最大输出限制，不实现 token ledger、token reservation 或用户用量仪表盘。
- 增加全局 AI 紧急关闭开关；provider 预算/告警和服务指标负责发现成本异常。

验收：多实例并发、边界时间、provider timeout/cancel/error 和槽位回收测试通过。

## 阶段 6：视频最小保护与观测

- 不增加订阅专用日次数、用户容量、reservation 表、计费分类或客户端上传字段。
- 沿用现有单文件大小、类型、对象存在性和附件安全校验，不改变 batch/Live Photo 正常上传体验。
- 基于现有 finalized 附件记录输出视频数量、字节和存储增长的低基数指标。
- 增加视频全局紧急停用开关和存储告警；停用不映射为 paywall 或“再次购买”提示。
- 将精细用户配额列为数据触发的后续设计，不进入 v1 完成条件。

验收：现有 batch/Live Photo/重试行为无回归；finalized 指标可观测；紧急停用不会误导购买。

## 阶段 7：联调、可观测性与发布

- 增加 route latency/error、outbox backlog、签名失败、grant lease horizon、AI 限额和视频存储增长指标；标签不包含用户或交易高基数字段。
- 与 Paid contract suite 联调高/低 revision、callback retry、删除后 404/orphaned、多订阅聚合和 HMAC 轮换。
- 与 iOS 联调 session、activate 503 后重试、restore、Offer Code 和 transaction finish 时序。
- 先部署 schema/callback（billing disabled），再部署 Paid，最后只对 sandbox allowlist 开启官方实例。

每个代码阶段按仓库规则在 `server/` 运行 `bun run lint`、`bun run build` 及相关测试。任何 DNS、Dokploy、App Store Connect 或生产开关变更必须另获授权。

## 完成定义

- 自托管默认行为和现有 permission API 无回归。
- Paid 故障不进入 AI/视频/permissions 正常请求路径。
- 授权不会越过 24 小时 lease，旧 revision 不覆盖新状态。
- App 激活只有在本地 grant 已提交后成功。
- 有效订阅不会被自动合并到其他账号；删除不依赖 Paid 且本地 grant 不残留。
- AI 基础限额在多实例和重试下不可绕过；视频不引入订阅专用 quota 状态机。
- 日志、错误和指标不包含完整 JWS、transaction ID、email、JWT 或 HMAC secret。
