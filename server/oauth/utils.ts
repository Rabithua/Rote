import { createHash, randomBytes } from 'crypto';
import type { HonoContext } from '../types/hono';
import { getApiUrl } from '../utils/main';
import messages from './messages.json';

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const OAUTH_AUTHORIZATION_REQUEST_TTL_SECONDS = 10 * 60;
export const OAUTH_AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
export const OAUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function randomOAuthToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceS256(verifier: string): string {
  return sha256Base64Url(verifier);
}

export function getMcpResource(c: HonoContext): string {
  return `${getApiUrl(c)}/v2/api/mcp`;
}

export function getOAuthIssuer(c: HonoContext): string {
  return getApiUrl(c);
}

export function getOAuthAuthorizeEndpoint(c: HonoContext): string {
  return `${getApiUrl(c)}/v2/api/oauth/authorize`;
}

export function getOAuthTokenEndpoint(c: HonoContext): string {
  return `${getApiUrl(c)}/v2/api/oauth/token`;
}

export function getOAuthRegisterEndpoint(c: HonoContext): string {
  return `${getApiUrl(c)}/v2/api/oauth/register`;
}

export function getOAuthRevokeEndpoint(c: HonoContext): string {
  return `${getApiUrl(c)}/v2/api/oauth/revoke`;
}

export function expiresIn(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

export function assertValidRedirectUri(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(messages.codes.redirectUriInvalid);
  }

  if (parsed.hash) {
    throw new Error(messages.codes.redirectUriFragmentForbidden);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1';

  if (parsed.protocol === 'https:') {
    return;
  }

  if (parsed.protocol === 'http:' && isLocalhost) {
    return;
  }

  if (isPrivateUseRedirectUri(value)) {
    return;
  }

  throw new Error(messages.codes.redirectUriSchemeForbidden);
}

export function isPrivateUseRedirectUri(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.hash) return false;
  const scheme = parsed.protocol.slice(0, -1).toLowerCase();
  const blockedSchemes = new Set([
    'about',
    'blob',
    'data',
    'file',
    'ftp',
    'http',
    'https',
    'javascript',
    'mailto',
  ]);
  if (blockedSchemes.has(scheme)) return false;
  if (!/^[a-z][a-z0-9+.-]{2,63}$/.test(scheme)) return false;

  return Boolean(parsed.hostname || parsed.pathname);
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * RFC 8252 §7.3: loopback clients bind an ephemeral port per run, so a
 * registered loopback URI matches on scheme, host, path, and query while the
 * port may differ. The relaxation is scoped to plain-http loopback redirects;
 * every other URI keeps requiring an exact match.
 */
export function isRegisteredRedirectUri(
  registeredUris: readonly string[],
  redirectUri: string
): boolean {
  if (registeredUris.includes(redirectUri)) return true;

  let requested: URL;
  try {
    requested = new URL(redirectUri);
  } catch {
    return false;
  }
  // RFC 6749 §3.1.2 forbids fragments in redirect URIs, and userinfo is never
  // part of a legitimate callback — reject both instead of ignoring them.
  if (requested.hash || requested.username || requested.password) return false;
  // RFC 8252 §7.3 port variance is scoped to plain-http loopback redirects.
  if (requested.protocol !== 'http:') return false;
  const hostname = requested.hostname.toLowerCase();
  if (!isLoopbackHostname(hostname)) return false;

  return registeredUris.some((registered) => {
    let candidate: URL;
    try {
      candidate = new URL(registered);
    } catch {
      return false;
    }
    return (
      candidate.protocol === requested.protocol &&
      candidate.hostname.toLowerCase() === hostname &&
      candidate.pathname === requested.pathname &&
      candidate.search === requested.search
    );
  });
}

export async function parseFormBody(c: HonoContext): Promise<Record<string, string>> {
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await c.req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }

  const body = await c.req.json().catch(() => ({}));
  const out: Record<string, string> = {};
  Object.entries(body as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === 'string') {
      out[key] = value;
    }
  });
  return out;
}

export function appendOAuthRedirectParams(
  redirectUri: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(redirectUri);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}
