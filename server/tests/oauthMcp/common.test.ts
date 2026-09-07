import { randomBytes } from 'crypto';
import testConfig from '../../scripts/testConfig.json';

export const BASE_URL = process.env.TEST_BASE_URL || testConfig.testSettings.baseUrl;
export const API_BASE = BASE_URL + testConfig.testSettings.apiBase + '/api';
export const MCP_RESOURCE = API_BASE + '/mcp';
export const REDIRECT_URI = 'http://localhost:8765/oauth/callback';
export const ALL_SCOPES = [
  'notes:read',
  'notes:write',
  'notes:delete',
  'notes:share',
  'articles:read',
  'articles:write',
  'articles:delete',
  'reactions:write',
  'reactions:delete',
  'profile:read',
  'profile:write',
  'stats:read',
  'settings:read',
  'settings:write',
  'attachments:write',
  'attachments:delete',
  'video:upload',
];

export type Json = Record<string, any>;

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertStatus(status: number, expected: number, label: string) {
  assert(status === expected, label + ': expected ' + expected + ', got ' + status);
}

function base64Url(input: ArrayBuffer | Uint8Array): string {
  return Buffer.from(input).toString('base64url');
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(digest);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export async function request(
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    redirect?: RequestRedirect;
    form?: URLSearchParams;
  } = {}
): Promise<{ status: number; headers: Headers; data: any }> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  let body: BodyInit | undefined;
  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = options.form.toString();
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(API_BASE + path, {
    method,
    headers,
    body,
    redirect: options.redirect || 'follow',
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { status: response.status, headers: response.headers, data };
}

export async function publicRequest(path: string) {
  const response = await fetch(BASE_URL + path);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { status: response.status, data };
}

export async function ensureInitialized() {
  const status = await request('GET', '/admin/status');
  assertStatus(status.status, 200, 'admin status');
  if (status.data.data?.isInitialized) return;

  const setup = await request('POST', '/admin/setup', {
    body: {
      site: {
        ...testConfig.testData.site,
        frontendUrl: 'http://localhost:3001',
        allowedOrigins: ['http://localhost:3001'],
      },
      ui: testConfig.testData.ui,
      admin: testConfig.testData.admin,
    },
  });
  assert(
    setup.status === 200 || setup.status === 400,
    'admin setup should initialize or report already initialized, got ' + setup.status
  );
}

export async function loginOrRegister(): Promise<string> {
  const login = await request('POST', '/auth/login', {
    body: {
      username: testConfig.testData.admin.username,
      password: testConfig.testData.admin.password,
    },
  });
  if (login.status === 200 && login.data.data?.accessToken) return login.data.data.accessToken;

  const suffix = Date.now().toString(36);
  const register = await request('POST', '/auth/register', {
    body: {
      username: ('mcpuser' + suffix).slice(0, 20),
      password: testConfig.testData.admin.password,
      email: 'mcp-' + suffix + '@test.com',
      nickname: 'MCP Test User',
    },
  });
  assertStatus(register.status, 201, 'fallback user registration');
  assert(register.data.data?.accessToken, 'registration did not return accessToken');
  return register.data.data.accessToken;
}

export async function registerClient(scopes = ALL_SCOPES): Promise<{ client_id: string }> {
  const response = await request('POST', '/oauth/register', {
    body: {
      client_name: 'Rote MCP OAuth Test',
      redirect_uris: [REDIRECT_URI],
      scope: scopes.join(' '),
    },
  });
  assertStatus(response.status, 201, 'dynamic client registration');
  assert(response.data.client_id, 'registered client_id is missing');
  assert(response.data.token_endpoint_auth_method === 'none', 'public client auth method mismatch');
  return response.data;
}
