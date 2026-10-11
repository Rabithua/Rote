# AI conversation history

AI history belongs to the authenticated account on the selected Rote site. The database stores complete, versioned conversation snapshots; Web and iOS keep an account/site-scoped cache and pending changes. Provider requests and existing SSE protocols are unchanged. Model context still uses the latest six valid messages on clients.

History endpoints require a valid JWT and remain available when generation permissions, provider configuration or vector storage are unavailable. The server never derives ownership from a source or planner's embedded `ownerId`.

## API and data

Paths below are relative to the configured API base (the server mounts its existing router at `/v2/api`). Responses use the existing `{code,message,data}` envelope.

| Request | Result |
| --- | --- |
| `GET /ai/conversations?limit=20&cursor=…` | `{conversations,nextCursor}` with complete snapshots, including empty deletion tombstones |
| `GET /ai/conversations/:id` | `{conversation}` or owner-scoped 404 |
| `PUT /ai/conversations/:id` | Body `{baseRevision,createdAt,agentConversationId?,messages}`; returns `{conversation}` |
| `DELETE /ai/conversations/:id?baseRevision=N` | Returns an empty tombstone with incremented revision |

`baseRevision:null` creates only. Existing conversations require a matching revision for changes. A repeated identical snapshot with a known prior revision returns the current revision without changing activity; a future revision is invalid. Conflicting writes/deletes return HTTP 409 with `{conversation:current}`. Clients retain unsynced content and show the conflict instead of replacing it or blindly retrying. Tombstones take precedence over pending saves and imports; the same deleted identity cannot be recreated.

Conversation IDs and message IDs are independent of Agent run IDs. IDs are 1–160 printable ASCII characters, supporting legacy timestamp/random IDs and UUIDs. Conversation `createdAt` remains the original client creation date. The server owns `updatedAt`; selecting or reading history does not bump activity or revision. Dates use ISO8601 UTC, durations use milliseconds, and token counters retain `prompt_tokens`, `completion_tokens` and `total_tokens`.

The canonical TypeScript DTO is `server/aiConversations/types.ts`. The shared realistic JSON fixture is `server/aiConversations/fixtures/rich-history.json`. It includes source previews, a retrieval plan, thinking, process/answer rounds, token phases and an interrupted partial answer. Optional metadata survives storage. Final answer text appears once in `Message.content`; answer outputs only keep their round metadata. `isStreaming` is transient. Stable snapshots settle running statuses, and pending assistants are represented as interrupted until the final snapshot replaces them at the same IDs.

Canonical output `status` is a timeline item. Source counts use `type:progress`, `phase:retrieving` and `retrieval`; an evidence limit uses `type:tool` and `toolStatus:evidence_limit`. Clients derive their own localized labels. An optional stored message provides a display fallback for older clients.

PUT requests are limited to 8 MiB total, 2,000 messages, and 1 MiB for each content/thinking text field. The list defaults to 20 entries and accepts at most 50. Each row includes its entire transcript, so list size grows with transcript length (a page can be much larger than a summary list). Clients fetch all pages and reconcile by identity/revision. Pagination is ordered by activity and ID; entries can move when another device writes, so absence in one listing does not imply deletion. Only explicit tombstones delete cached entries.

## Client writes and legacy import

Clients journal stable snapshots at send/start, completion, cancellation and failure. Writes and deletion are serialized per conversation and use the latest revision when actually sent. A failed save leaves the cache and pending journal intact. An active generation keeps its optimistic version even after its start snapshot is acknowledged; a divergent update from another device becomes a conflict, so completion cannot overwrite it by adopting a refreshed version. A delete intent is journaled before awaiting an in-flight create, then DELETE follows its acknowledgement. Late replies from an old account/site cannot update or upload the new account's view.

Web's former `aiChatMessages` key contains one unscoped transcript with no reliable owner. Preserve it locally until the current account explicitly chooses “Import this browser's old chats”; that action claims it once for the account/site. Do not upload or claim it merely because someone logs in. Existing epoch-millisecond message ID prefixes supply stable legacy dates; unsupported old IDs use a persisted import fallback. Import uses a stable identity, checks cloud tombstones, and marks completion only after a successful acknowledgement. New scoped caches sync normally.

Account deletion cascades database history. Account merge transfers source history in the same transaction; owner-local ID collisions preserve both rows by assigning the source row a new ID without replacing the target row or its tombstone.

## Migration and verification

Drizzle migration `0038_ai_conversation_history` follows the committed note-sync cursor migration and adds `ai_conversations` with an owner/ID primary key, activity index, positive revision and empty-tombstone constraints. Deploying the server runs the existing startup migrator. Include the generated SQL, journal entry and snapshot together.

The dedicated CI job runs an upgrade from migration 37 with pre-existing user/note data and committed sync cursors, actual PostgreSQL repository concurrency/ownership/delete tests, real JWT route tests, the schema regeneration check and client synchronization tests. Local database tests require isolated `rote_ai_conversation_test` / `rote_ai_conversation_migration_test` databases via their test-specific environment variables. Run repository and route suites in separate Bun processes because each closes its database pool.

This implementation persists snapshots received from connected clients. It cannot save tokens a disconnected client never received, and it does not add server-side provider lifecycle persistence. Production deployment, production migration and App Store release are separate actions. The repository's `develop` push workflow builds images and triggers the configured production Compose webhook; creating a PR does not authorize merging or deploying it.
