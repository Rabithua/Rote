# Frontend cache policy

The stable entry URLs select the current release. `web/nginx.conf` serves HTML,
SPA navigations, `/sw.js`, `/registerSW.js`, and `/manifest.json` with
`Cache-Control: no-store`. Only fingerprinted files under `/assets/` have a
one-year immutable cache lifetime. Missing assets return 404 instead of HTML.

The service worker's navigation request also uses `cache: 'no-store'`, so an
older HTTP cache cannot supply the app shell after this worker activates.
Workbox's revisioned asset precache is unchanged. Anonymous `/s/` navigation
and share APIs remain excluded from offline caching.

## CDN configuration and rollout

Origin headers alone cannot fix a CDN rule that forces a cache lifetime.
For `rote.ink`, configure both the **node cache TTL** and **browser cache TTL**:

- `/assets/*`: respect origin caching; immutable versioned files may be cached.
- All other paths: do not cache, preserving the origin's `no-store` response.
- Disable any rule that overwrites entry HTML or `/sw.js` with a positive
  `max-age`. The share paths must retain `no-referrer` and `noindex` headers.

After updating these rules, purge the old `/`, `/index.html`, `/sw.js`,
`/registerSW.js`, `/manifest.json`, and cached `/s/` entries. Browser and CDN
caches are separate: changing origin configuration does not remove old edge
objects or already-stored browser responses. Do not clear account storage or
unregister push subscriptions to perform this rollout.

An old service worker may still control the first navigation. After its update
activates, reopen the original share link and check that the reader renders.
Verify an existing browser session as well as a fresh session; adding a query
parameter alone does not bypass an old worker's navigation handler.

## Verification

Build in `web/` with `bun run build`, then serve `web/dist` through Nginx using
`web/nginx.conf`. Run:

```sh
bun run scripts/verify-cache-policy.ts http://127.0.0.1:38081
```

CI runs this HTTP check against an actual Nginx container. It checks entry files,
SPA and share routes, fingerprinted JavaScript, missing assets, and sharing
privacy headers. Run the same command with the deployed frontend origin after
the CDN configuration and purge. It uses only a synthetic share path and does
not retrieve a real note or include a bearer token.

References: [Vite PWA cache guidance](https://vite-pwa-org.netlify.app/deployment/),
[EdgeOne node cache TTL](https://cloud.tencent.com/document/product/1552/70777),
[EdgeOne browser cache TTL](https://edgeone.ai/document/46176).
