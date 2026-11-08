import assert from 'node:assert/strict';

const [origin, mode] = process.argv.slice(2);
assert(
  origin && (mode === 'present' || mode === 'absent'),
  'Usage: bun run scripts/verify-site-head-meta.ts <frontend-origin> <present|absent>'
);

const configuredTags = [
  '<meta name="twitter:creator" content="@rabithua">',
  '<meta property="og:image" content="https://example.test/card.png">',
];
const sharePath = '/s/site-head-meta-check';

// Check the share first, before the origin can cache a fragment for other routes.
for (const path of [sharePath, '/', '/index.html', '/home']) {
  const headers =
    path === sharePath
      ? {
          authorization: 'Bearer fixture',
          cookie: 'rote-meta=fixture',
          referer: new URL(path, origin).href,
        }
      : undefined;
  const response = await fetch(new URL(path, origin), { redirect: 'error', headers });
  assert.equal(response.status, 200, `${path}: HTML status`);
  assert.equal(response.headers.get('cache-control'), 'no-store', `${path}: cache policy`);

  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  assert(head && html.includes('<div id="root"></div>'), `${path}: usable app shell`);
  assert.doesNotMatch(
    html,
    /UPSTREAM_META_MUST_NOT_APPEAR|an error occurred while processing the directive/
  );

  for (const tag of configuredTags) {
    if (mode === 'present') {
      assert(head.includes(tag), `${path}: expected ${tag} in the initial HTML head`);
    } else {
      assert(!html.includes(tag), `${path}: ${tag} must not appear`);
    }
  }
  if (path === sharePath) {
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  }
}

const internal = await fetch(new URL('/_rote/site-head-meta', origin), { redirect: 'error' });
assert.equal(internal.status, 404, 'The HTML fragment location is internal');
process.stdout.write(`PASS site Meta is ${mode} on regular and share routes\n`);
