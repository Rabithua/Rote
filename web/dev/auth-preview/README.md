# Authentication preview

Run `bun run dev:auth-preview` from `web/`, then open
<http://127.0.0.1:3147/__auth-preview>.

The preview runs the real login components against a development-only Vite
middleware. API requests stay on the preview origin. WebAuthn responses and OAuth
callbacks are simulated; the preview never creates a real account or passkey.
The middleware and browser simulation are absent from production builds.

The toolbar switches between all methods, OAuth only, no OAuth with Passkeys available, traditional
login, disabled registration for existing or new OAuth identities, unsupported Passkeys,
canceled or unavailable Passkeys, returning
OAuth accounts with and without a Passkey, and expired OAuth registration. Appearance can be switched
between light and dark. Restart clears the preview origin's mock login session.
Add `previewLanguage=en` or `previewLanguage=ja` to a direct `/login` preview URL
to inspect the localized layout. Without it, the preview uses Chinese.

Registration-off scenarios keep existing OAuth, password and Passkey sign-in
available. `closed` simulates a bound OAuth account that signs in normally;
`closed-new` simulates an unbound identity and rejects new-account creation.
Pending OAuth username confirmation is also blocked if registration is disabled
between authorization and confirmation.

Apple is the first and only highlighted OAuth method. A localized “or” divider
separates OAuth from the full-width Passkey sign-in button. When no OAuth provider
is enabled, the original username/password login and registration tabs become the
main area; an available Passkey sign-in button stays below those forms. Passkey sign-in goes
straight to simulated credential selection and signs in as `passkey_user`,
without a username form. Passkeys cannot create new accounts. The no-passkey
scenario cancels sign-in; the cancellation scenario also cancels adding a key to
an existing account. Neither automatically opens account registration.
OAuth continues to use one combined sign-in/creation entry, asking new users only
for a username. Existing usernames such as `passkey_user`, `password_user`, and
`taken` are unavailable for registration. The original traditional
signup form retains username, email, nickname, and password. Successful flows reach a mock
confirmation page instead of the application dashboard. Existing accounts add
Passkeys from account settings; signing in does not display a setup prompt.

This preview validates presentation and client flow. The server integration tests
exercise the real registration transactions, credential checks, and database
migration separately.
