// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authPreviewApi } from './api';

const disabledScenarios = ['closed', 'closed-new'] as const;
const returnUrl = '/login?redirect=%2F__auth-preview%2Fsuccess';

let server: Server;
let origin: string;

beforeEach(async () => {
  const handle = authPreviewApi();
  server = createServer((req, res) => {
    void handle(req, res, new URL(req.url || '/', origin)).catch((error: unknown) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP preview server');
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function request(path: string, scenario: string, body?: Record<string, unknown>) {
  return fetch(`${origin}/v2/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Cookie: `rote-auth-preview=${scenario}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
  });
}

async function oauthCallback(provider: string, scenario: string) {
  const response = await request(
    `/auth/oauth/${provider}?redirect=${encodeURIComponent(returnUrl)}`,
    scenario
  );
  expect(response.status).toBe(302);
  return new URL(response.headers.get('Location')!);
}

describe('registration-disabled auth preview', () => {
  it.each(disabledScenarios)(
    'keeps login methods enabled while registration is %s',
    async (scenario) => {
      const response = await request('/site/status', scenario);
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({
        ui: { allowRegistration: false },
        oauth: {
          enabled: true,
          providers: { apple: { enabled: true }, github: { enabled: true } },
        },
        passkey: { enabled: true },
      });
    }
  );

  it.each(['apple', 'github'])(
    'allows an existing %s binding to sign in while closed',
    async (provider) => {
      const callback = await oauthCallback(provider, 'closed');
      expect(callback.pathname).toBe('/login');
      expect(callback.searchParams.get('redirect')).toBe('/__auth-preview/success');
      expect(callback.searchParams.get('oauth')).toBe('success');
      expect(callback.searchParams.get('provider')).toBe(provider);
      expect(callback.searchParams.get('token')).toBeTruthy();
      expect(callback.searchParams.get('refreshToken')).toBeTruthy();
      expect(callback.searchParams.has('registrationToken')).toBe(false);
      expect(callback.searchParams.has('errorCode')).toBe(false);
    }
  );

  it.each(['apple', 'github'])('rejects a new %s identity while closed', async (provider) => {
    const callback = await oauthCallback(provider, 'closed-new');
    expect(callback.searchParams.get('oauth')).toBe('error');
    expect(callback.searchParams.get('errorCode')).toBe('registration_disabled');
    expect(callback.searchParams.get('provider')).toBe(provider);
    expect(callback.searchParams.get('redirect')).toBe('/__auth-preview/success');
    expect(callback.searchParams.has('token')).toBe(false);
    expect(callback.searchParams.has('registrationToken')).toBe(false);
  });

  it.each(disabledScenarios)(
    'blocks a prepared OAuth signup under %s without consuming it',
    async (scenario) => {
      const callback = await oauthCallback('apple', 'all');
      expect(callback.searchParams.get('oauth')).toBe('register');
      const registrationToken = callback.searchParams.get('registrationToken');
      expect(registrationToken).toBeTruthy();
      const detailsPath = `/auth/register/oauth/${registrationToken}`;
      expect((await request(detailsPath, 'all')).status).toBe(200);

      const blockedDetails = await request(detailsPath, scenario);
      expect(blockedDetails.status).toBe(403);
      expect((await blockedDetails.json()).errorCode).toBe('registration_disabled');

      const registration = { registrationToken, username: 'after_reopening' };
      const blockedCompletion = await request('/auth/register/oauth', scenario, registration);
      expect(blockedCompletion.status).toBe(403);
      expect((await blockedCompletion.json()).errorCode).toBe('registration_disabled');

      expect((await request(detailsPath, 'all')).status).toBe(200);
      const completed = await request('/auth/register/oauth', 'all', registration);
      expect(completed.ok).toBe(true);
      const result = (await completed.json()).data;
      expect(result.user.username).toBe(registration.username);
      expect(result.user.email).toBeNull();
      expect(new URL(result.completionUrl).searchParams.get('oauth')).toBe('success');
      expect((await request(detailsPath, 'all')).status).toBe(410);
    }
  );

  it.each(disabledScenarios)(
    'keeps password and Passkey sign-in available under %s',
    async (scenario) => {
      const password = await request('/auth/login', scenario, {
        username: 'password_user',
        password: 'password123',
      });
      expect(password.status).toBe(200);
      expect((await password.json()).data.user.username).toBe('password_user');

      const optionsResponse = await request('/auth/passkey/authenticate/options', scenario, {});
      expect(optionsResponse.status).toBe(200);
      const { challengeKey } = (await optionsResponse.json()).data;
      const passkey = await request('/auth/passkey/authenticate/verify', scenario, {
        challengeKey,
        credential: { id: 'preview-credential' },
      });
      expect(passkey.status).toBe(200);
      expect((await passkey.json()).data.user.username).toBe('passkey_user');
    }
  );

  it.each(disabledScenarios)('rejects traditional signup under %s', async (scenario) => {
    const response = await request('/auth/register', scenario, {
      username: 'new_password_user',
      email: 'new@example.test',
      password: 'password123',
    });
    expect(response.status).toBe(403);
    expect((await response.json()).errorCode).toBe('registration_disabled');
  });
});
