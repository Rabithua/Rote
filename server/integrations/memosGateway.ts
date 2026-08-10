import { assertSafeOutboundUrl } from '../utils/adminHooks/network';

const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export class MemosGatewayError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 502 | 504
  ) {
    super(code);
  }
}

export async function requestMemosPage({
  accessToken,
  body,
  fetcher = fetch,
  assertSafeUrl = assertSafeOutboundUrl,
}: {
  accessToken?: string;
  body: unknown;
  fetcher?: typeof fetch;
  assertSafeUrl?: typeof assertSafeOutboundUrl;
}) {
  if (!accessToken || accessToken.length > 1024) {
    throw new MemosGatewayError('memos_unauthorized', 401);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new MemosGatewayError('memos_invalid_request', 400);
  }
  const input = body as Record<string, unknown>;
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const state = input.state;
  if (state !== 'NORMAL' && state !== 'ARCHIVED') {
    throw new MemosGatewayError('memos_invalid_request', 400);
  }
  const pageToken = typeof input.pageToken === 'string' ? input.pageToken : '';
  if (pageToken.length > 2048) throw new MemosGatewayError('memos_invalid_request', 400);

  const url = new URL(`${baseUrl}/api/v1/memos`);
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('state', state);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetchSafeMemosResponse({
    initialUrl: url.toString(),
    baseUrl,
    accessToken,
    fetcher,
    assertSafeUrl,
  });
  if (response.status === 401) throw new MemosGatewayError('memos_unauthorized', 401);
  if (response.status === 403) throw new MemosGatewayError('memos_forbidden', 403);
  if (!response.ok) throw new MemosGatewayError('memos_invalid_response', 502);

  const data = await readLimitedJson(response);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { memos?: unknown }).memos)) {
    throw new MemosGatewayError('memos_invalid_response', 502);
  }
  return data;
}

async function fetchSafeMemosResponse({
  initialUrl,
  baseUrl,
  accessToken,
  fetcher,
  assertSafeUrl,
}: {
  initialUrl: string;
  baseUrl: string;
  accessToken: string;
  fetcher: typeof fetch;
  assertSafeUrl: typeof assertSafeOutboundUrl;
}) {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    try {
      await assertSafeUrl(currentUrl, 'Memos instance URL');
    } catch {
      throw new MemosGatewayError('memos_invalid_request', 400);
    }

    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (sameOrigin(currentUrl, baseUrl)) headers.Authorization = `Bearer ${accessToken}`;
      response = await fetcher(currentUrl, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new MemosGatewayError('memos_timeout', 504);
      }
      throw new MemosGatewayError('memos_unreachable', 502);
    }

    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location || redirect === MAX_REDIRECTS) {
      await response.body?.cancel();
      throw new MemosGatewayError('memos_invalid_response', 502);
    }
    await response.body?.cancel();
    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new MemosGatewayError('memos_invalid_response', 502);
    }
  }
  throw new MemosGatewayError('memos_invalid_response', 502);
}

async function readLimitedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^(0|[1-9][0-9]*)$/u.test(declaredLength) &&
    BigInt(declaredLength) > BigInt(MAX_RESPONSE_BYTES)
  ) {
    await response.body?.cancel();
    throw new MemosGatewayError('memos_invalid_response', 502);
  }
  if (!response.body) throw new MemosGatewayError('memos_invalid_response', 502);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new MemosGatewayError('memos_invalid_response', 502);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof MemosGatewayError) throw error;
    throw new MemosGatewayError('memos_invalid_response', 502);
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new MemosGatewayError('memos_invalid_response', 502);
  }
}

function sameOrigin(value: string, baseUrl: string) {
  try {
    return new URL(value).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new MemosGatewayError('memos_invalid_request', 400);
  }
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error();
    url.pathname = url.pathname.replace(/\/+$/u, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/u, '');
  } catch {
    throw new MemosGatewayError('memos_invalid_request', 400);
  }
}
