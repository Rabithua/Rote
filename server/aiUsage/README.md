# AI usage statistics

The provider clients record one row per dispatched HTTP attempt. Business callers
provide `usageContext` with the requester and purpose; tests and probes default to
system maintenance. Public search passes the viewer separately from the owner
used to filter content. Indexing uses the document owner.

The recorder reads raw provider usage before response/finish validation and writes
in `finally`. Repeated cumulative frames replace the current snapshot. Request IDs
are unique and persistence uses an upsert. Missing token values stay null; cache
and reasoning fields are subsets and never added to the total. Failed database
writes emit `ai_usage_persist_failed` with only the request ID and error class.
There is no durable recovery queue, and usage never received cannot be restored.

Migration `0036_ai_usage_statistics` preserves old numbers as `legacy`, without
inventing provider metadata. Account deletion sets `userid` to null and keeps
only anonymous usage counts; the log stores no prompts or user profile fields.

`GET /admin/stats/ai-usage` requires admin access. It accepts `startAt`, `endAt`
(ISO timestamps, both required together), `type` (`all`, `chat`, `embedding`), and
optional `model`. The default is a rolling 30-day window. The window is half-open
`[startAt, endAt)`. The UI sends explicit boundaries, using Asia/Shanghai for the
current calendar month. All sections use one query/snapshot and token totals are
decimal strings. `calls` excludes legacy rows; new-call coverage uses only
`reportedCalls / calls`. System and anonymous groups are subsets of the overview.
The existing dashboard's `topUsersByTokenUsage` response remains available.

`GET /admin/stats/ai-usage/users` provides the complete user usage table with the
same admin requirement and range/type/model filters. It accepts `page` (starting
at 1) and `limit` (1–100, default 20), and returns `users` and `pagination`
(`page`, `limit`, `total`, `pages`). All users with records in the selected window
are reachable, ordered by total tokens descending and user ID to break ties.
System checks and anonymous/deleted accounts remain in their summary groups.

Run unit tests with `bun test aiUsage/recording.test.ts`. The integration suite
requires an **empty, disposable** PostgreSQL database named `ai_usage_test` with
pgvector available. Set `POSTGRESQL_URL` to that database and run
`bun test aiUsage/recording.test.ts aiUsage/integration.test.ts`. It migrates an old
schema, checks retained logs, and exercises provider failure/cancellation,
requester attribution, API authorization, aggregation and deletion. CI provisions
this database in its own job. Never point the suite at a running application DB.

The normal server startup applies the migration. Production rollout is separate
from preparing the change; merging to develop triggers the deployment workflow.
