import { beforeEach, describe, expect, it, vi } from 'vitest';
import { continueWithPasskey } from './passkey';

const { publicPost, startRegistration, startAuthentication } = vi.hoisted(() => ({
  publicPost: vi.fn(),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

vi.mock('./api', () => ({
  publicPost,
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));
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
  startRegistration.mockResolvedValue(credential);
  startAuthentication.mockResolvedValue(credential);
});

describe('continue with a passkey', () => {
  it('creates a credential only when the server selects new-account registration', async () => {
    publicPost
      .mockResolvedValueOnce({
        data: {
          method: 'register',
          options: registrationOptions,
          registrationToken: 'new-account-token',
        },
      })
      .mockResolvedValueOnce({ data: tokens });

    await expect(continueWithPasskey({ username: 'reader' })).resolves.toEqual(tokens);

    expect(publicPost).toHaveBeenNthCalledWith(1, '/auth/passkey/continue/options', {
      username: 'reader',
    });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: registrationOptions });
    expect(startAuthentication).not.toHaveBeenCalled();
    expect(publicPost).toHaveBeenNthCalledWith(2, '/auth/register/passkey/verify', {
      credential,
      registrationToken: 'new-account-token',
      deviceName: expect.any(String),
    });
    expect(publicPost).toHaveBeenCalledTimes(2);
  });

  it('authenticates an existing account with the challenge selected for that account', async () => {
    publicPost
      .mockResolvedValueOnce({
        data: {
          method: 'authenticate',
          options: authenticationOptions,
          challengeKey: 'existing-account-challenge',
        },
      })
      .mockResolvedValueOnce({ data: tokens });

    await expect(continueWithPasskey({ username: 'reader' })).resolves.toEqual(tokens);

    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: authenticationOptions });
    expect(startRegistration).not.toHaveBeenCalled();
    expect(publicPost).toHaveBeenNthCalledWith(2, '/auth/passkey/authenticate/verify', {
      credential,
      challengeKey: 'existing-account-challenge',
    });
    expect(publicPost).toHaveBeenCalledTimes(2);
  });

  it.each(['register', 'authenticate'] as const)(
    'does not verify or switch methods after the user cancels %s',
    async (method) => {
      const cancellation = new DOMException('cancelled', 'NotAllowedError');
      publicPost.mockResolvedValueOnce({
        data:
          method === 'register'
            ? { method, options: registrationOptions, registrationToken: 'pending' }
            : { method, options: authenticationOptions, challengeKey: 'pending' },
      });
      (method === 'register' ? startRegistration : startAuthentication).mockRejectedValueOnce(
        cancellation
      );

      await expect(continueWithPasskey({ username: 'reader' })).rejects.toBe(cancellation);

      expect(publicPost).toHaveBeenCalledTimes(1);
      expect(
        method === 'register' ? startAuthentication : startRegistration
      ).not.toHaveBeenCalled();
    }
  );

  it.each(['passkey_not_available', 'registration_disabled'])(
    'does not attempt credential creation after %s',
    async (errorCode) => {
      const rejection = { response: { data: { errorCode } } };
      publicPost.mockRejectedValueOnce(rejection);

      await expect(continueWithPasskey({ username: 'reader' })).rejects.toBe(rejection);

      expect(startRegistration).not.toHaveBeenCalled();
      expect(startAuthentication).not.toHaveBeenCalled();
      expect(publicPost).toHaveBeenCalledTimes(1);
    }
  );

  it('propagates a registration race instead of retrying or authenticating another account', async () => {
    const conflict = { response: { data: { errorCode: 'username_unavailable' } } };
    publicPost
      .mockResolvedValueOnce({
        data: { method: 'register', options: registrationOptions, registrationToken: 'pending' },
      })
      .mockRejectedValueOnce(conflict);

    await expect(continueWithPasskey({ username: 'reader' })).rejects.toBe(conflict);

    expect(publicPost).toHaveBeenCalledTimes(2);
    expect(startAuthentication).not.toHaveBeenCalled();
  });
});
