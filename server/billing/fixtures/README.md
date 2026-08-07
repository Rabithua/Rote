# Provisional Paid-to-Rote contract fixtures

`provisional-v1.json` is the deterministic, non-production contract source for the first
Rote Server billing phase. The Paid Server must copy these cases and produce the same UTF-8
bytes, SHA-256 hashes, canonical request, and HMAC before the provisional label is removed.

Canonical queries use RFC 3986 percent encoding, sort encoded key/value pairs bytewise, retain
duplicate keys, and encode spaces as `%20`. Canonical request lines are joined by LF with no
trailing newline. Snapshot hashes exclude `deliveryId`, normalize revisions to decimal strings
and dates to millisecond UTC ISO strings, and sort capability keys.

The v1 billing capability allowlist contains only `ai.chat` and `attachment.video.upload`.

The fixture secret is public test material and must never be deployed.

`rote-to-paid-v1.json` is copied byte-for-byte from the Paid-owned canonical fixture. Its
`secretHex` is public test bytes used only by contract tests. Deployed outbound secrets remain
exact UTF-8 environment values and are never implicitly decoded. The fixture freezes session and
activation request bytes/signatures, success and duplicate envelopes, and all App-facing errors.
