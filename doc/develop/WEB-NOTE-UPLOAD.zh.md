# Web 笔记附件流程与验收

## 流程

Web 以 iOS 的远端提交顺序为参考，采用「先保存笔记，再提交附件批次」。

1. 选图、粘贴或拖入文件只保存浏览器 File 和本地预览，不发上传请求。
2. 点击发送，先 POST `/notes`，用草稿持有的 UUID 作为 `Idempotency-Key`；编辑已有笔记则 PUT 同一笔记。
3. 笔记保存成功后生成图片预览或视频封面，再请求 `/attachments/presign`，声明所有待传对象的准确大小。
4. 服务端支持 `attachmentDirectBrowserUpload` 时，原文件、预览图、封面都由浏览器用签名 URL 直传对象存储。
5. 所有对象完成后，调用 `/attachments/finalize-batch`，提交稳定的 `batchId`、`clientId`、`noteId` 和包含已有附件的完整顺序。
6. 批次确认成功后清空编辑器并刷新笔记列表。

不支持 `attachmentBatchFinalize` 的自托管实例仍使用原有 finalize + sort 协议；不以运行时请求失败触发协议降级。

## 失败语义与边界

- 创建笔记响应丢失：使用相同创建 ID 重试，不重复生成笔记。
- 某个对象上传失败：保留已保存笔记、当前批次和成功对象；用户点击重试时刷新签名，只补传未完成对象。
- finalize 响应丢失：重放相同批次，不重新上传文件。
- 失败期间附件选择与排序保持固定；仍可修改正文，重试时更新原笔记。
- 用户明确放弃待上传附件时，取消预约并读取服务器实际附件，保留已经确认绑定的结果。
- 发送期间锁定编辑器，并阻止连续点击/快捷键产生并发提交。
- 仅保留当前页面中的文件与上传进度；刷新页面需要重新选文件。本次不引入 iOS 的离线数据库、后台同步或浏览器持久化上传队列。
- 笔记和附件并非一个跨存储事务：上传失败时文字笔记已经存在，界面会明确提示。

## 本地验收

连接本地 API、独立测试数据库和配置好 CORS 的本地对象存储；开启 managed storage 后确认 site/status 中两项上传能力均为 true。

| 场景 | 预期 |
| --- | --- |
| 选择多张图片 | 显示本地预览，Network 中没有 presign/上传请求 |
| 发送图片笔记 | notes → presign → 各对象 PUT → finalize-batch；新笔记及附件各一份 |
| 连续点击发送 | 同一草稿只产生一条笔记 |
| 阻断 staging 下 compressed 对象请求 | 不调用 finalize-batch；提示笔记已保存、附件待重试 |
| 恢复网络后点击重试 | 不再 POST notes，不重传已成功原图，只补齐缺失对象 |
| 丢失 finalize 响应后重试 | 同一 batchId 重放，没有新 presign 或对象 PUT |
| 编辑已有笔记并添加图片、排序 | 不新建笔记，已有和新增附件按界面完整顺序绑定 |
| 上传视频 | 视频和浏览器生成的封面均直传；仍遵守单视频、不可混选图片规则 |
| 放弃待上传附件 | 保留文字和已绑定附件，允许重新选择附件 |

自动化回归：

```sh
# web/
bun run test -- src/features/attachments
bun run lint
bun run build

# server/；NOTE_ACTIONS_TEST_DATABASE_URL 必须指向已迁移的独立测试数据库
bun test notes/actions.integration.test.ts attachments/finalizeBatch.test.ts attachments/finalizeReservation.test.ts
bun run lint
bun run build
```
