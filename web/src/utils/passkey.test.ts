import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateWithPasskey, registerPasskey } from './passkey';
import { authService } from './auth';

const { publicPost, post, startRegistration, startAuthentication } = vi.hoisted(() => ({
  publicPost: vi.fn(),
  post: vi.fn(),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

vi.mock('./api', () => ({ publicPost, post, get: vi.fn(), del: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn: () => true,
}));

const registrationOptions = { challenge: 'registration-challenge', user: { name: 'reader' } };
const authenticationOptions = { challenge: 'authentication-challenge' };
const credential = { id: 'credential-id', type: 'public-key' };
const tokens = { user: { username: 'reader' }, accessToken: 'access', refreshToken: 'refresh' };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  startRegistration.mockResolvedValue(credential);
  startAuthentication.mockResolvedValue(credential);
});

describe('explicit Passkey access', () => {
  it('authenticates discoverable credentials without sending a username', async () => {
    publicPost
      .mockResolvedValueOnce({
        data: { options: authenticationOptions, challengeKey: 'login-challenge' },
      })
      .mockResolvedValueOnce({ data: tokens });

    await expect(authenticateWithPasskey()).resolves.toEqual(tokens);

    expect(publicPost).toHaveBeenNthCalledWith(1, '/auth/passkey/authenticate/options', {});
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: authenticationOptions });
    expect(publicPost).toHaveBeenNthCalledWith(2, '/auth/passkey/authenticate/verify', {
      credential,
      challengeKey: 'login-challenge',
    });
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it('does not verify or create a credential when login is cancelled', async () => {
    const cancellation = new DOMException('cancelled', 'NotAllowedError');
    publicPost.mockResolvedValueOnce({
      data: { options: authenticationOptions, challengeKey: 'pending' },
    });
    startAuthentication.mockRejectedValueOnce(cancellation);

    await expect(authenticateWithPasskey()).rejects.toBe(cancellation);

    expect(publicPost).toHaveBeenCalledTimes(1);
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it('propagates an unknown credential instead of switching to account creation', async () => {
    const unknownCredential = { response: { data: { errorCode: 'passkey_not_found' } } };
    publicPost
      .mockResolvedValueOnce({ data: { options: authenticationOptions, challengeKey: 'pending' } })
      .mockRejectedValueOnce(unknownCredential);

    await expect(authenticateWithPasskey()).rejects.toBe(unknownCredential);

    expect(publicPost).toHaveBeenCalledTimes(2);
    expect(startRegistration).not.toHaveBeenCalled();
  });
});

describe('adding a Passkey to the current account', () => {
  const tokenFor = (userId: string, version = 'original') =>
    `header.${btoa(JSON.stringify({ userId, version, exp: 4102444800 }))}.signature`;
  const accountToken = tokenFor('account-a');

  function replaceSession(kind: 'same-tab' | 'cross-tab' | 'logout') {
    if (kind === 'same-tab') {
      authService.setTokens(tokenFor('account-b'), 'account-b-refresh-token');
    } else if (kind === 'cross-tab') {
      // Another tab changes localStorage without incrementing this tab's revision.
      localStorage.setItem('rote_access_token', tokenFor('account-b'));
    } else {
      authService.clearTokens();
    }
  }

  it('enrolls for an unchanged authenticated session', async () => {
    authService.setTokens(accountToken, 'account-a-refresh-token');
    post
      .mockResolvedValueOnce({ data: { options: registrationOptions } })
      .mockResolvedValueOnce({ data: {} });

    await expect(registerPasskey()).resolves.toBe(true);

    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: registrationOptions });
    expect(post).toHaveBeenNthCalledWith(1, '/auth/passkey/register/options', {});
    expect(post).toHaveBeenNthCalledWith(2, '/auth/passkey/register/verify', {
      credential,
      deviceName: expect.any(String),
    });
  });

  it('allows a same-account token renewal during the OS ceremony', async () => {
    authService.setTokens(accountToken, 'account-a-refresh-token');
    post
      .mockResolvedValueOnce({ data: { options: registrationOptions } })
      .mockResolvedValueOnce({ data: {} });
    startRegistration.mockImplementationOnce(async () => {
      authService.setTokens(tokenFor('account-a', 'renewed'), 'renewed-refresh-token');
      return credential;
    });

    await expect(registerPasskey()).resolves.toBe(true);

    expect(post).toHaveBeenCalledWith('/auth/passkey/register/verify', {
      credential,
      deviceName: expect.any(String),
    });
  });

  it.each(['same-tab', 'cross-tab', 'logout'] as const)(
    'does not open the OS ceremony after a %s session change while options are pending',
    async (kind) => {
      authService.setTokens(accountToken, 'account-a-refresh-token');
      let resolveOptions!: (value: unknown) => void;
      post.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOptions = resolve;
          })
      );
      const enrollment = registerPasskey();
      const rejection = expect(enrollment).rejects.toMatchObject({ name: 'AbortError' });

      replaceSession(kind);
      resolveOptions({ data: { options: registrationOptions } });
      await rejection;

      expect(startRegistration).not.toHaveBeenCalled();
      expect(post).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['same-tab', 'cross-tab', 'logout'] as const)(
    'does not verify an old credential after a %s session change during the OS ceremony',
    async (kind) => {
      authService.setTokens(accountToken, 'account-a-refresh-token');
      post.mockResolvedValueOnce({ data: { options: registrationOptions } });
      let resolveCredential!: (value: unknown) => void;
      const ceremonyStarted = new Promise<void>((resolveStarted) => {
        startRegistration.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveCredential = resolve;
              resolveStarted();
            })
        );
      });
      const enrollment = registerPasskey();
      const rejection = expect(enrollment).rejects.toMatchObject({ name: 'AbortError' });
      await ceremonyStarted;

      replaceSession(kind);
      resolveCredential(credential);
      await rejection;

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).not.toHaveBeenCalledWith('/auth/passkey/register/verify', expect.anything());
    }
  );
});
