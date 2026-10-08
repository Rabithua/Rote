# OpenKey formal import protocol

All endpoints are under `/v2/api/openkey`. Send the OpenKey through `Authorization: Bearer …` or `x-api-key`, never in an import URL. No storage HEAD/GET/COPY or media processing is added to direct upload finalization.

| Endpoint | Purpose | OpenKey permissions |
| --- | --- | --- |
| `POST /imports/connect` | Minimal owner profile and protocol/capability handshake | GETROTE, SENDROTE |
| `POST /imports/plan` | Existing source filtering via planImportData | GETROTE, SENDROTE |
| `POST /imports` | Formal commit via importData | GETROTE, SENDROTE |
| `POST /imports/attachments/cleanup` | Queue deletion of owned, unbound, non-profile attachments (`ids`, max 100) | UPLOADATTACHMENT |
| `DELETE /imports/reservations/:id` | Cancel upload; recover unbound ids from completed finalize results after response loss | UPLOADATTACHMENT |

Plan and commit use the existing formatVersion 2 payload. Maximum 50 notes and 50 articles per request. Defaults are `existingStrategy: "skip"`, `visibilityStrategy: "private"`. Explicit overwrite additionally requires EDITROTE. Articles use the formal importer's upsert semantics and require both SENDARTICLE and EDITARTICLE. A commit containing attachments additionally requires UPLOADATTACHMENT. Presign/finalize enforce account attachment/video capabilities and UPLOADVIDEO as before.

Connect reports protocolVersion 1, formalImport 2, source identity, historical createdAt, unbound binding, browser direct upload, cleanup, MIME/size/count limits and permission-dependent attachment/video/overwrite/article capabilities. Consumers must check this before importing, including the actual browser's cross-origin request.

Plan returns `noteIndexes`. Commit adds per-note `results: [{ index, id, status }]`, where status is created, updated or skipped, alongside existing counts. Source mapping, historical dates, default privacy and current-owner unbound attachment binding remain owned by the existing formal importer.

Clients plan all selected sources before downloading media. For each new attachment: generate its derivatives in the browser, presign with `browserDirectUpload: true` and actual MIME/size, PUT original and derivative separately, finalize using the returned reservationId, then commit the complete note. Direct uploads also receive reservations on unmanaged instances, enabling cleanup without changing legacy clients. Image previews may be WebP; video posters follow the existing separate JPEG poster protocol.

Cleanup reuses attachment ownership/profile guards and the resource outbox. Bound attachments are preserved even when a commit response is lost. Physical deletion is asynchronous through the existing maintenance worker; cancelling unfinished reservations waits for issued PUT credentials to expire before physical cleanup, preventing late uploads from recreating objects. Failed cleanup must be retried; completed reservation results allow recovery when finalize succeeded but its response was lost.

Validation uses disposable local PostgreSQL accounts and route integration tests. The Rerote browser acceptance chain used these real routes, real presigning and a local in-memory object-store fixture. No production deployment or real-account bulk import is part of this change.
