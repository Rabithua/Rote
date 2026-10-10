# Note sync protocol

These authenticated endpoints live under `/v2/api/sync` and use the existing response envelope.

- `GET /snapshot` returns `{ noteIds: string[], cursor: string }`. Both fields come from one PostgreSQL repeatable-read snapshot. IDs include every note owned by the account, including archived notes. Fetch note bodies through the existing `POST /v2/api/notes/batch` endpoint in batches of at most 100.
- `GET /changes?cursor=...&limit=100` returns `{ changes: [{ id, originid, action, revision }], nextCursor, hasMore }`. Actions are `CREATE`, `UPDATE`, and `DELETE`; revisions are decimal strings. Pages are ordered by revision and retain the first page's upper boundary until `hasMore` is false. Treat cursors as opaque and account-specific. Save `nextCursor` only after all pages and fetched bodies have been applied and saved locally.

Full reconciliation starts with `/snapshot`, loads its notes, and consumes changes after its cursor. Remove previously synced local notes absent from the final membership, while preserving pending local edits/uploads. An empty snapshot and empty feed still produce a valid checkpoint.

The per-account revision row is advanced in the same transaction as each note mutation and its journal entries. Its lock lasts through commit, preventing later revisions from committing first. Bulk writes allocate a contiguous range with one counter update. No persistent snapshot, worker, media processing, or periodic scan is introduced.

Apply migration `0037_rote_sync_cursor.sql` and deploy the backend before releasing the matching iOS client. Historical journal rows have no revision; the new client's first full snapshot repairs old missed updates/deletions. Legacy timestamp endpoints retain their response shape for older clients. New writes continue to populate those endpoints.

Malformed/cross-account cursors and invalid limits return HTTP 400. A cursor beyond the account's current revision returns HTTP 409 (`sync_cursor_ahead`); restart from a full snapshot after a server restore/reset.

Database regression tests use an isolated migrated PostgreSQL database:

```sh
SYNC_TEST_DATABASE_URL=postgresql://... bun test sync/repository.integration.test.ts
bun test sync/cursor.test.ts
```
