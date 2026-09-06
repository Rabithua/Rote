import assert from 'node:assert/strict';

const origin = process.argv[2];
assert(origin, 'Usage: bun run scripts/verify-cache-policy.ts <frontend-origin>');

async function get(path: string) {
  return fetch(new URL(path, origin), { redirect: 'error', cache: 'no-store' });
}

const index = await get('/index.html');
const html = await index.text();
const asset = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
assert(asset, 'The built entry HTML must reference a fingerprinted JavaScript asset');

for (const path of [
  '/',
  '/index.html',
  '/home',
  '/sw.js',
  '/manifest.json',
  '/s/cache-policy-check',
]) {
  const response = await get(path);
  assert.equal(response.status, 200, `${path}: status`);
  assert.match(
    response.headers.get('cache-control') ?? '',
    /\bno-store\b/,
    `${path}: cache policy`
  );
  assert.doesNotMatch(
    response.headers.get('cache-control') ?? '',
    /immutable|(?:s-)?max-age=[1-9]/,
    `${path}: stale cache`
  );
  if (path.startsWith('/s/')) {
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
  }
  if (path === '/sw.js') {
    assert.match(response.headers.get('content-type') ?? '', /javascript/);
  }
  process.stdout.write(`PASS ${path}\n`);
}

const versioned = await get(asset);
assert.equal(versioned.status, 200);
assert.match(versioned.headers.get('cache-control') ?? '', /immutable/);
assert.match(versioned.headers.get('cache-control') ?? '', /max-age=31536000/);
assert.match(versioned.headers.get('content-type') ?? '', /javascript/);
assert.equal((await get('/assets/missing-cache-check.js')).status, 404);
assert.equal((await get('/registerSW.js')).headers.get('cache-control'), 'no-store');
process.stdout.write(
  'PASS fingerprinted assets stay immutable; missing scripts never become HTML\n'
);
