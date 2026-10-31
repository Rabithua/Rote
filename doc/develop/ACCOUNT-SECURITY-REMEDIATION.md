# Account merge and signing-key remediation

## Compatibility and authorization

GitHub and Apple login, binding, unbinding, and the existing account merge dialog
remain available. `POST /v2/api/auth/oauth/:provider/bind/merge` retains its request
fields (`existingUserId`, provider-specific user ID, and optional username) and
success response.

A successful provider callback now records a ten-minute merge authorization for
the authenticated destination, source account, provider identity, and exact source
binding record. The merge endpoint requires this server-side authorization.
Knowing account IDs, supplying an initiation state, or disabling OAuth does not
authorize a merge. Existing dialogs opened before deployment must restart binding.

Authorization consumption and the complete account transfer commit together.
Repeating the same successful request returns its saved result for 24 hours.
Database failures roll back the transfer and authorization together. Expiration or
a changed binding requires another OAuth authorization. Billing restrictions and
the existing data-transfer rules remain in effect.

Merge failures preserve the usual response envelope and add `errorCode`:

| HTTP | Error code | Client action |
| --- | --- | --- |
| 400 | `oauth_merge_invalid_request` | Correct the request fields. |
| 403 | `oauth_merge_authorization_required` | Restart OAuth binding. |
| 403 | `oauth_merge_disabled` | Wait until this provider is enabled. |
| 409 | `oauth_merge_conflict` | Reload binding state and restart binding. |
| 409 | `oauth_merge_billing_blocked` | Retain the existing managed-billing restriction. |
| 500 | `oauth_merge_failed` | Show the localized failure; retry within the authorization lifetime. |

## Configuration API

All `GET /admin/settings` responses, including single-group queries, and settings
update responses omit `jwtSecret`, `jwtRefreshSecret`, and `sessionSecret` for every
role. They remain internal configuration fields.

`PUT /admin/settings` with `group: "security"` updates only supplied top-level
editable fields. Omitted fields retain their stored values. Supplied OAuth and
Passkey objects are complete replacement values for their respective fields.
Normal administrators retain their existing configuration permissions.

Any attempt to submit a signing-key field returns HTTP 403 with
`security_signing_keys_not_editable`; invalid configuration input returns HTTP 400
with `security_settings_invalid`. A page holding configuration cached before this
release must refresh before saving. The server never silently accepts an attempt
to overwrite a signing key.

`POST /admin/settings/regenerate-keys` requires a super administrator:

- An absent body or `{ "scope": "authentication" }` rotates the access-token,
  refresh-token, and OAuth-state signing keys, preserving all other configuration.
- `{ "scope": "all" }` also rotates the VAPID key pair. This explicit operation can
  require Web Push clients to subscribe again.
- Responses contain masked private keys. Initialization independently fills
  missing keys, preserving existing authentication keys, complete VAPID key pairs,
  and other settings.

## Release procedure

1. Take the normal database backup, and validate the additive
   `0039_oauth_merge_authorizations` migration in staging. Keep credentials out of
   command output, logs, screenshots, and repository files.
2. Apply database migrations, replace every backend instance with the patched
   revision, and verify backend health before publishing the frontend. The bundled
   Compose file waits for backend health before starting the frontend. Confirm the
   actual Dokploy configuration uses the same ordering.
3. Publish the frontend, verify its revision and health, and refresh any open admin
   pages. Cached old forms may receive the deliberate signing-key rejection.
4. Use an existing authenticated super-admin session to call the key-rotation
   endpoint with `scope: "authentication"`. This invalidates existing access and
   refresh tokens and OAuth states. Users must sign in once again.
   MCP access tokens also expire on rotation; their database-backed refresh tokens
   remain usable to obtain new access tokens. In-flight legacy signed upload-proxy
   requests may need to be restarted. Do not keep accepting the retired signing key.
5. Restart every API and worker process that reads authentication configuration;
   each process keeps its own configuration cache. Do not leave an instance using
   the old keys, and do not reintroduce an old configuration backup afterward.
6. Confirm old access, refresh, and state credentials fail; newly authenticated
   sessions work; a normal admin cannot read or overwrite signing keys; provider
   login, authorized merge, configuration saving, and Web Push still work. Review
   account deletions and administrator role changes for unexpected activity.

Rollback uses a corrected build retaining both authorization boundaries. Do not
restore the vulnerable merge endpoint or the retired signing keys. The additive
table can remain during rollback.

## Validation

The CI security job uses separate isolated PostgreSQL databases and actual JWT
authentication. Provider responses are simulated; no real provider credentials or
production accounts are required. Run the account-merge suite using
`OAUTH_MERGE_TEST_DATABASE_URL` pointing to `rote_oauth_merge_test`, and settings
tests using `ADMIN_SETTINGS_TEST_DATABASE_URL` pointing to
`rote_security_settings_test`, after migrations. Run each suite in its own Bun
process. Frontend form and OAuth-feedback tests run with Vitest.

Both `server/` and `web/` must pass `bun run lint` and `bun run build`, followed by
the repository Codex commit quality gate. Attachment upload, client-side media
processing, existing preview assets, and storage verification policy are outside
this remediation.
