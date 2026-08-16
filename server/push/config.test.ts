import { afterEach, describe, expect, it } from 'bun:test';
import { getApnsConfig, isPushNotificationsEnabled, validateTimeZone } from './config';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe('push configuration', () => {
  it('is disabled by default for self-hosted deployments', () => {
    delete process.env.PUSH_NOTIFICATIONS_ENABLED;
    expect(isPushNotificationsEnabled()).toBe(false);
  });

  it('accepts IANA time zones and rejects invalid identifiers', () => {
    expect(validateTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai');
    expect(validateTimeZone('America/New_York')).toBe('America/New_York');
    expect(() => validateTimeZone('not/a-time-zone')).toThrow('Invalid IANA time zone');
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
});
