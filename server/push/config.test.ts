import { afterEach, describe, expect, it } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { validateApnsCredentials } from './apns';
import { getApnsConfig, isPushNotificationsEnabled, validateTimeZone } from './config';
import { PushApiError } from './errors';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe('push configuration', () => {
  it('is disabled by default for self-hosted deployments', () => {
    delete process.env.PUSH_NOTIFICATIONS_ENABLED;
    expect(isPushNotificationsEnabled()).toBe(false);
  });

  it('accepts IANA time zones and rejects invalid identifiers with a stable code', () => {
    expect(validateTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai');
    expect(validateTimeZone('America/New_York')).toBe('America/New_York');
    try {
      validateTimeZone('not/a-time-zone');
      throw new Error('expected invalid time zone to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PushApiError);
      expect((error as PushApiError).code).toBe('push_invalid_time_zone');
      expect((error as PushApiError).status).toBe(400);
    }
  });

  it('selects the APNs host for the requested environment', () => {
    process.env.APNS_KEY_ID = 'KEY';
    process.env.APNS_TEAM_ID = 'TEAM';
    process.env.APNS_TOPIC = 'ink.rote.app';
    process.env.APNS_PRIVATE_KEY = 'private\\nkey';
    expect(getApnsConfig('sandbox').origin).toBe('https://api.sandbox.push.apple.com');
    expect(getApnsConfig('production').origin).toBe('https://api.push.apple.com');
    expect(getApnsConfig('production').privateKey).toBe('private\nkey');
  });

  it('fails APNs preflight for incomplete or invalid credentials', async () => {
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_TOPIC;
    delete process.env.APNS_PRIVATE_KEY;
    await expect(validateApnsCredentials()).rejects.toThrow('APNs credentials are incomplete');

    process.env.APNS_KEY_ID = 'KEY';
    process.env.APNS_TEAM_ID = 'TEAM';
    process.env.APNS_TOPIC = 'ink.rote.app';
    process.env.APNS_PRIVATE_KEY = 'not a private key';
    await expect(validateApnsCredentials()).rejects.toThrow();
  });

  it('accepts a valid P-256 PKCS#8 APNs private key', async () => {
    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.APNS_KEY_ID = 'KEY';
    process.env.APNS_TEAM_ID = 'TEAM';
    process.env.APNS_TOPIC = 'ink.rote.app';
    process.env.APNS_PRIVATE_KEY = privateKey;
    await expect(validateApnsCredentials()).resolves.toBeUndefined();
  });
});
