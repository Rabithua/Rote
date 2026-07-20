const WEREAD_GATEWAY = 'https://i.weread.qq.com/api/agent/gateway';
const UPSTREAM_TIMEOUT_MS = 30_000;
const WEREAD_SKILL_VERSION = '1.0.4';

const ALLOWED_APIS = new Set(['/user/notebooks', '/book/bookmarklist', '/review/list/mine']);

export type WereadGatewayErrorCode =
  | 'weread_invalid_key'
  | 'weread_invalid_request'
  | 'weread_api_forbidden'
  | 'weread_timeout'
  | 'weread_unreachable'
  | 'weread_invalid_response';

export class WereadGatewayError extends Error {
  constructor(
    public readonly code: WereadGatewayErrorCode,
    public readonly status: number
  ) {
    super(code);
  }
}

export async function requestWereadGateway({
  apiKey,
  body,
  fetcher = fetch,
}: {
  apiKey: string | undefined;
  body: unknown;
  fetcher?: typeof fetch;
}): Promise<unknown> {
  if (!apiKey || !/^wrk-[A-Za-z0-9_-]{4,508}$/u.test(apiKey)) {
    throw new WereadGatewayError('weread_invalid_key', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WereadGatewayError('weread_invalid_request', 400);
  }

  const apiName = (body as Record<string, unknown>).api_name;
  if (typeof apiName !== 'string' || !ALLOWED_APIS.has(apiName)) {
    throw new WereadGatewayError('weread_api_forbidden', 403);
  }
  const gatewayBody = sanitizeGatewayBody(body as Record<string, unknown>, apiName);

  let response: Response;
  try {
    response = await fetcher(WEREAD_GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gatewayBody),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new WereadGatewayError('weread_timeout', 504);
    }
    throw new WereadGatewayError('weread_unreachable', 502);
  }

  const responseBody = await response.json().catch(() => null);
  if (!responseBody || typeof responseBody !== 'object') {
    throw new WereadGatewayError('weread_invalid_response', 502);
  }
  if (response.status === 401 || response.status === 403) {
    throw new WereadGatewayError('weread_invalid_key', 401);
  }
  if (!response.ok) {
    throw new WereadGatewayError('weread_invalid_response', 502);
  }

  return responseBody;
}

function sanitizeGatewayBody(body: Record<string, unknown>, apiName: string) {
  const base = {
    api_name: apiName,
    skill_version: WEREAD_SKILL_VERSION,
  };

  if (apiName === '/user/notebooks') {
    return {
      ...base,
      count: 100,
      ...optionalCursor(body, 'lastSort'),
    };
  }

  const bookKey = apiName === '/book/bookmarklist' ? 'bookId' : 'bookid';
  const bookId = body[bookKey];
  if (typeof bookId !== 'string' || !bookId.trim() || bookId.length > 256) {
    throw new WereadGatewayError('weread_invalid_request', 400);
  }

  if (apiName === '/book/bookmarklist') {
    return { ...base, bookId: bookId.trim() };
  }

  return {
    ...base,
    bookid: bookId.trim(),
    count: 100,
    synckey: optionalCursor(body, 'synckey').synckey ?? 0,
  };
}

function optionalCursor(
  body: Record<string, unknown>,
  key: 'lastSort' | 'synckey'
): Partial<Record<'lastSort' | 'synckey', number>> {
  const value = body[key];
  if (value === undefined) return {};
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new WereadGatewayError('weread_invalid_request', 400);
  }
  return { [key]: value };
}
