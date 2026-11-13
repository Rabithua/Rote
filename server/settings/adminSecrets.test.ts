import { describe, expect, it } from 'bun:test';
import {
  maskNotificationSecretsForAdmin,
  maskOAuthSecretsForAdmin,
  maskStorageSecretForAdmin,
  oauthProviderCredentialChanges,
  resolveMaskedOAuthProviderSecrets,
  resolveNotificationSecrets,
  resolveStorageSecret,
} from './adminSecrets';

describe('admin secret masking', () => {
  const storage = {
    endpoint: 'https://storage.example.test',
    bucket: 'isolated-bucket',
    accessKeyId: 'isolated-access-key',
    secretAccessKey: 'isolated-secret-key',
    urlPrefix: 'https://cdn.example.test',
  };

  it('masks the storage secret without touching identifiers', () => {
    const masked = maskStorageSecretForAdmin(storage);
    expect(masked.secretAccessKey).toBe('********');
    expect(masked.accessKeyId).toBe(storage.accessKeyId);
    expect(masked.bucket).toBe(storage.bucket);
  });

  it('leaves empty storage configs untouched', () => {
    expect(maskStorageSecretForAdmin({})).toEqual({});
  });

  it('masks OAuth provider secrets but keeps identifiers and callbacks', () => {
    const masked = maskOAuthSecretsForAdmin({
      enabled: true,
      providers: {
        github: {
          enabled: true,
          clientId: 'client-id',
          clientSecret: 'provider-secret',
          callbackUrl: 'https://example.test/callback',
        },
      },
    });
    expect(masked.providers.github.clientSecret).toBe('********');
    expect(masked.providers.github.clientId).toBe('client-id');
    expect(masked.providers.github.callbackUrl).toBe('https://example.test/callback');
  });

  it('treats masked placeholders and unchanged values as non-changes', () => {
    const existing = {
      oauth: {
        enabled: true,
        providers: {
          github: {
            enabled: true,
            clientId: 'client-id',
            clientSecret: 'stored-secret',
            callbackUrl: 'https://example.test/callback',
          },
        },
      },
    };
    expect(
      oauthProviderCredentialChanges(
        {
          providers: {
            github: {
              clientSecret: '********',
              callbackUrl: existing.oauth.providers.github.callbackUrl,
            },
          },
        },
        existing
      )
    ).toBe(false);
    expect(
      oauthProviderCredentialChanges(
        { providers: { github: { callbackUrl: 'https://attacker.example.test/callback' } } },
        existing
      )
    ).toBe(true);
    expect(
      oauthProviderCredentialChanges(
        { providers: { github: { clientSecret: 'attacker-secret' } } },
        existing
      )
    ).toBe(true);
    expect(oauthProviderCredentialChanges(undefined, existing)).toBe(false);
  });

  it('resolves masked placeholders back to stored secrets', () => {
    const existing = {
      oauth: {
        enabled: true,
        providers: {
          github: {
            enabled: true,
            clientId: 'client-id',
            clientSecret: 'stored-secret',
            callbackUrl: 'https://example.test/callback',
          },
        },
      },
    };
    const resolved = resolveMaskedOAuthProviderSecrets(
      { providers: { github: { enabled: true, clientId: 'client-id', clientSecret: '********' } } },
      existing
    );
    expect(resolved.providers.github.clientSecret).toBe('stored-secret');
    expect(resolved.providers.github.enabled).toBe(true);
  });

  it('keeps empty new-provider entries untouched when no prior secret exists', () => {
    const resolved = resolveMaskedOAuthProviderSecrets(
      { providers: { apple: { enabled: false, privateKey: '' } } },
      { oauth: { enabled: true, providers: {} } }
    );
    expect(resolved.providers.apple.privateKey).toBe('');
  });

  it('masks notification secrets and resolves placeholders per channel', () => {
    const existing = {
      vapidPublicKey: 'vapid-public',
      vapidPrivateKey: 'vapid-private',
      adminHooks: {
        enabled: true,
        channels: [{ id: 'hook-1', name: 'Hook', type: 'bark', key: 'bark-key', enabled: true }],
      },
    };
    const masked = maskNotificationSecretsForAdmin(existing);
    expect(masked.vapidPublicKey).toBe('vapid-public');
    expect(masked.vapidPrivateKey).toBe('********');
    expect(masked.adminHooks.channels[0].key).toBe('********');

    const resolved = resolveNotificationSecrets(
      {
        vapidPublicKey: 'vapid-public',
        vapidPrivateKey: '********',
        adminHooks: {
          enabled: true,
          channels: [{ id: 'hook-1', name: 'Hook', type: 'bark', key: '********', enabled: true }],
        },
      },
      existing
    );
    expect(resolved.vapidPrivateKey).toBe('vapid-private');
    expect(resolved.adminHooks.channels[0].key).toBe('bark-key');
  });

  it('masks HTTP hook header values per value, preserving the object shape', () => {
    const masked = maskNotificationSecretsForAdmin({
      vapidPublicKey: 'vapid-public',
      vapidPrivateKey: 'vapid-private',
      adminHooks: {
        enabled: true,
        channels: [
          {
            id: 'http-hook',
            name: 'Hook',
            type: 'http',
            url: 'https://hooks.example.test/endpoint',
            headers: { Authorization: 'Bearer token-1', 'X-Trace': 'trace-1' },
            enabled: true,
          },
        ],
      },
    });
    const channel = masked.adminHooks.channels[0];
    expect(channel.headers).toEqual({
      Authorization: '********',
      'X-Trace': '********',
    });
    expect(typeof channel.headers).toBe('object');
  });

  it('resolves masked header values per key and keeps new headers', () => {
    const existing = {
      vapidPublicKey: 'vapid-public',
      vapidPrivateKey: 'vapid-private',
      adminHooks: {
        enabled: true,
        channels: [
          {
            id: 'http-hook',
            name: 'Hook',
            type: 'http',
            url: 'https://hooks.example.test/endpoint',
            headers: { Authorization: 'Bearer stored-token' },
            enabled: true,
          },
        ],
      },
    };
    const resolved = resolveNotificationSecrets(
      {
        vapidPublicKey: 'vapid-public',
        vapidPrivateKey: 'vapid-private',
        adminHooks: {
          enabled: true,
          channels: [
            {
              id: 'http-hook',
              name: 'Hook',
              type: 'http',
              url: 'https://hooks.example.test/endpoint',
              headers: { Authorization: '********', 'X-New': 'new-value' },
              enabled: true,
            },
          ],
        },
      },
      existing
    );
    expect(resolved.adminHooks.channels[0].headers).toEqual({
      Authorization: 'Bearer stored-token',
      'X-New': 'new-value',
    });
  });

  it('resolves masked or empty storage secrets back to the stored value', () => {
    const existing = { secretAccessKey: 'stored-secret' };
    expect(resolveStorageSecret({ secretAccessKey: '********' }, existing)).toBe('stored-secret');
    expect(resolveStorageSecret({ secretAccessKey: '' }, existing)).toBe('stored-secret');
    expect(resolveStorageSecret({ secretAccessKey: 'new-secret' }, existing)).toBe('new-secret');
    expect(resolveStorageSecret({ secretAccessKey: '' }, {})).toBeUndefined();
  });
});
