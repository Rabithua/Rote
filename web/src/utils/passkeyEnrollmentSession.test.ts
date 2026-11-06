import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { authService } from './auth';
import { registerPasskey } from './passkey';

const { startRegistration } = vi.hoisted(() => ({ startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration,
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: () => true,
}));

const originalAdapter = api.defaults.adapter;
const registrationOptions = { challenge: 'account-a-registration', user: { name: 'reader' } };
const credential = { id: 'new-account-a-passkey', type: 'public-key' };
const token = (kind: string, exp: number) =>
  `header.${btoa(JSON.stringify({ userId: 'account-a', username: 'reader', kind, exp }))}.signature`;

describe('Passkey enrollment with the API authentication interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    startRegistration.mockResolvedValue(credential);
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('enrolls after an expired access token is refreshed for the same account', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredAccessToken = token('expired-access', now - 60);
    const refreshToken = token('refresh', now + 3600);
    const renewedAccessToken = token('renewed-access', now + 900);
    const renewedRefreshToken = token('renewed-refresh', now + 7200);
    authService.setTokens(expiredAccessToken, refreshToken);
    const refresh = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { data: { accessToken: renewedAccessToken, refreshToken: renewedRefreshToken } },
    });
    const adapter = vi.fn(async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        code: 0,
        data:
          config.url === '/auth/passkey/register/options' ? { options: registrationOptions } : {},
      },
    }));
    api.defaults.adapter = adapter;

    await expect(registerPasskey()).resolves.toBe(true);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: registrationOptions });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      '/auth/passkey/register/options',
      '/auth/passkey/register/verify',
    ]);
    for (const [config] of adapter.mock.calls) {
      expect(config.headers.Authorization).toBe(`Bearer ${renewedAccessToken}`);
    }
    expect(authService.getAccessToken()).toBe(renewedAccessToken);
  });
});
