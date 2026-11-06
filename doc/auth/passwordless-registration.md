# Passwordless registration

OAuth and Passkey registration require only a username. New passwordless accounts have no
email address or password; their nickname initially matches the selected username. Traditional
email/password registration retains its email requirement. Existing users and bindings are not
rewritten by the migration.

## OAuth

The provider callback first resolves the verified `provider + providerId` binding. Existing
bindings sign in immediately, including when new-account registration is disabled.

An unbound identity receives a ten-minute, opaque registration credential and returns to
`/login?oauth=register&registrationToken=...`. Only a SHA-256 digest of this credential is stored
in PostgreSQL. The pending record retains the verified provider identity and original return
context, but no provider access token. No Rote account or login token exists at this point.

- `GET /auth/register/oauth/:registrationToken` returns `{ provider, suggestedUsername }`.
- `POST /auth/register/oauth` accepts `{ registrationToken, username }` and returns
  `{ user, accessToken, refreshToken, completionUrl }` in the standard response envelope.

The completion transaction locks the pending authorization, rechecks registration/provider
availability, creates the account and provider binding, and marks the credential consumed.
The policy check reads and share-locks current stored settings in that same transaction, so
configuration cached by another server process cannot authorize a disabled registration.
Invalid or occupied usernames leave the authorization available for another attempt. Replays,
expired credentials and competing provider registrations cannot create another account.

The client follows `completionUrl` after saving the returned login tokens. The server builds
this URL from its retained context: the existing Web callback (including the nested MCP
authorization destination), or `rote://callback` for an iOS login. Confirmation request fields
cannot replace the provider identity or return URL.

Errors include a stable top-level `errorCode` for localized UI feedback:

| Code | HTTP status |
| --- | --- |
| `username_invalid`, `oauth_registration_invalid` | 400 |
| `registration_disabled`, `oauth_disabled` | 403 |
| `username_unavailable`, `oauth_registration_conflict` | 409 |
| `oauth_registration_expired` | 410 |

OAuth registration does not match accounts by email. An existing traditional account owner
signs in to that account and binds the provider from account settings.

## Passkey

The primary card has one Passkey entry for both sign-in and account creation. It asks for a
username, then `POST /auth/passkey/continue/options` selects the credential ceremony:

- An existing account with Passkeys receives authentication options restricted to that account,
  together with an account-bound authentication challenge.
- An available username receives registration options and a registration credential, provided
  new-account registration is enabled.
- An existing account without a Passkey receives `passkey_not_available`, so it can sign in
  using its original method instead of accidentally creating another account.

Verification uses the existing authentication or registration verification endpoint. Credential
verification and account creation complete together, so cancelling the operating-system prompt
leaves no empty account. Existing clients can continue using the anonymous authentication and
standalone registration endpoints.

## Verification

The database tests require `AUTH_REGISTRATION_TEST_DATABASE_URL` pointing to an isolated database
named `rote_auth_registration_test`. Apply repository migrations before running:

```sh
cd server
bun test oauthAccounts/registration.integration.test.ts
```

The suite covers deferred account creation, email independence, username retries, credential
expiry/replay, registration disablement, concurrent submissions and provider registrations,
trusted Web/MCP/iOS completion contexts, and existing-account sign-in.
