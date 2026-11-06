# Authentication preview

Run `bun run dev:auth-preview` from `web/`, then open
<http://127.0.0.1:3147/__auth-preview>.

The preview runs the real login components against a development-only Vite
middleware. API requests stay on the preview origin. WebAuthn responses and OAuth
callbacks are simulated; the preview never creates a real account or passkey.
The middleware and browser simulation are absent from production builds.

The toolbar switches between all methods, OAuth only, Passkey only, traditional
login, disabled registration, unsupported Passkeys, canceled Passkeys, returning
OAuth accounts, and expired OAuth registration. Appearance can be switched
between light and dark. Restart clears the preview origin's mock login session.
Add `previewLanguage=en` or `previewLanguage=ja` to a direct `/login` preview URL
to inspect the localized layout. Without it, the preview uses Chinese.

The single Passkey entry asks for a username and continues with sign-in for
`passkey_user`, or account creation for another available valid username.
`password_user` and `taken` represent existing accounts without a passkey and
must use another sign-in method. OAuth also uses one combined entry.
The Passkey fixture `legacy_` followed by 93 `u` characters exercises the
supported 100-character legacy username and authorization text wrapping.
Passkey and OAuth signup ask only for a username. The original traditional
signup form retains username, email, nickname, and password. Successful flows reach a mock
confirmation page instead of the application dashboard.

This preview validates presentation and client flow. The server integration tests
exercise the real registration transactions, credential checks, and database
migration separately.
