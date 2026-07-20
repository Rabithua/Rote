import { assertSafeOutboundUrl } from '../utils/adminHooks/network';

const UPSTREAM_TIMEOUT_MS = 30_000;

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
  await assertSafeUrl(url.toString(), 'Memos instance URL');

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new MemosGatewayError('memos_timeout', 504);
    }
    throw new MemosGatewayError('memos_unreachable', 502);
  }
  if (response.status === 401) throw new MemosGatewayError('memos_unauthorized', 401);
  if (response.status === 403) throw new MemosGatewayError('memos_forbidden', 403);
  if (!response.ok) throw new MemosGatewayError('memos_invalid_response', 502);

  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { memos?: unknown }).memos)) {
    throw new MemosGatewayError('memos_invalid_response', 502);
  }
  return data;
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
