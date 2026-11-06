# Passwordless registration

OAuth account creation requires only a username. New OAuth accounts have no email address or
password; their nickname initially matches the selected username. Passkeys sign in to existing
accounts and cannot create new accounts. Traditional
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

The shared login screen lists enabled OAuth providers first, prioritizing Apple. Only the first
enabled OAuth provider is highlighted. When Passkeys are also available, a localized “or” divider
precedes a full-width Passkey sign-in button. Traditional forms remain under Other ways when
OAuth is available. Without an enabled OAuth provider, those original login/register forms are
the main content, followed by Passkey sign-in when available.

Passkey sign-in does not request a username. `POST /auth/passkey/authenticate/options` creates a
challenge for discoverable credentials. The browser presents saved credentials for the site;
`POST /auth/passkey/authenticate/verify` verifies the selected credential and signs in its existing
owner. Cancelling or failing authentication keeps the sign-in screen available. It never creates
an account or automatically starts account registration.

Authenticated users can add credentials to their existing account through
`POST /auth/passkey/register/options` and `POST /auth/passkey/register/verify`. These endpoints
require a valid session and do not create users. The client confirms account ownership after
receiving options and after the browser ceremony, allowing same-account token refresh while
preventing submission after logout or an account switch.

After ordinary Web OAuth sign-in or account creation, the dashboard can offer a dismissible
suggestion to add a Passkey. It checks browser support, the site setting, and existing credentials
first. Only selecting Add opens the system creation prompt. A per-account thirty-day cooldown
limits repeated offers. iOS handoffs and MCP authorization skip the suggestion and retain their
original completion destinations.

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
