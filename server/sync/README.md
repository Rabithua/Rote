# Note sync protocol

These authenticated endpoints live under `/v2/api/sync` and use the existing response envelope.

- `GET /snapshot` returns `{ noteIds: string[], cursor: string }`. Both fields come from one PostgreSQL repeatable-read snapshot. IDs include every note owned by the account, including archived notes. Fetch note bodies through the existing `POST /v2/api/notes/batch` endpoint in batches of at most 100.
- `GET /changes?cursor=...&limit=100` returns `{ changes: [{ id, originid, action, revision }], nextCursor, hasMore }`. Actions are `CREATE`, `UPDATE`, and `DELETE`; revisions are decimal strings. Pages are ordered by revision and retain the first page's upper boundary until `hasMore` is false. Treat cursors as opaque and account-specific. Save `nextCursor` only after all pages and fetched bodies have been applied and saved locally.

`POST /notes/batch` requires valid authentication whenever an Authorization header is supplied; invalid credentials return HTTP 401 instead of a partial guest result. Requests without credentials retain public-note access. Background link-preview writes and removals publish note updates in the same transaction, including the parent timestamp for legacy clients. Results for superseded note content are ignored; webpage fetches stay outside the transaction.

Full reconciliation starts with `/snapshot`, loads its notes, and consumes changes after its cursor. Remove previously synced local notes absent from the final membership, while preserving pending local edits/uploads. An empty snapshot and empty feed still produce a valid checkpoint.

The per-account revision row is advanced in the same transaction as each note mutation and its journal entries. Its lock lasts through commit, preventing later revisions from committing first. Bulk writes allocate a contiguous range with one counter update. No persistent snapshot, worker, media processing, or periodic scan is introduced.

Apply migration `0037_rote_sync_cursor.sql` and deploy the backend before releasing the matching iOS client. Historical journal rows have no revision; the new client's first full snapshot repairs old missed updates/deletions.

## Released-client compatibility and planned retirement

`GET /v2/api/changes/after?timestamp=...` remains available to released clients during the transition. Its timestamp inputs, `skip`/`limit` pagination, `action` filter, authentication and response envelope remain unchanged. The response retains the legacy fields and omits the new `revision` field. New mutations continue to populate the same `roteChanges` journal, so old clients can still read new writes without understanding cursors or revisions. This preserves the old protocol; it does not give old clients the new protocol's commit-order guarantees.

The timestamp-sync endpoint is planned for retirement in **November 2026 (2026-11)**. The exact cutoff has not been set. The current change marks the retirement plan only: it does not disable the route, introduce a date-triggered shutdown or change its response. New clients use `GET /v2/api/sync/snapshot` and `GET /v2/api/sync/changes` instead. Remove the legacy route and its timestamp reader together in the retirement change.

Shared note APIs, including `GET /v2/api/notes` and `POST /v2/api/notes/batch`, remain available; they are not part of this timestamp-sync retirement. Batch reads retain their body/response format and visibility rules. Supplied expired or invalid credentials return 401 to trigger the existing client refresh-and-retry flow; only requests without credentials use public visitor access.

Authentication recovery remains a client concern: an expired access token with a valid refresh token is refreshed silently and the original request is retried. An expired or invalid refresh token requires sign-in. The batch endpoint's 401 must not be interpreted as a successful partial sync or advance a sync checkpoint.

Malformed/cross-account cursors and invalid limits return HTTP 400. A cursor beyond the account's current revision returns HTTP 409 (`sync_cursor_ahead`); restart from a full snapshot after a server restore/reset.

Database regression tests use an isolated migrated PostgreSQL database:

```sh
SYNC_TEST_DATABASE_URL=postgresql://... bun test sync/repository.integration.test.ts
bun test sync/cursor.test.ts
SYNC_TEST_DATABASE_URL=postgresql://... bun test sync/noteContent.integration.test.ts
```

Run the database suites in separate Bun processes: each owns and closes the application's shared database pool and initializes its own authentication configuration.
