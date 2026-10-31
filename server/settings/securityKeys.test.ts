import { describe, expect, it } from 'bun:test';
import {
  initializeAuthenticationKeys,
  initializeNotificationKeys,
  isSecurityKeyRotationScope,
  rotateAuthenticationKeys,
  rotateNotificationKeys,
} from './securityKeys';

describe('security key lifecycle', () => {
  const auth = {
    jwtSecret: 'unit-access-key',
    jwtRefreshSecret: 'unit-refresh-key',
    sessionSecret: 'unit-state-key',
    jwtAccessExpiry: '2h',
    jwtRefreshExpiry: '14d',
    oauth: { enabled: false, providers: {} },
    passkey: { enabled: true },
    requireCertifiedUserForExplore: true,
  };
  const notification = {
    vapidPublicKey: 'unit-vapid-public',
    vapidPrivateKey: 'unit-vapid-private',
    adminHooks: { enabled: true, channels: [] },
  };

  it('initializes only missing authentication material and preserves configured policy', () => {
    expect(initializeAuthenticationKeys(auth)).toEqual(auth);
    const initialized = initializeAuthenticationKeys({ ...auth, jwtRefreshSecret: '' });
    expect(initialized.jwtRefreshSecret).toBeTruthy();
    expect({ ...initialized, jwtRefreshSecret: auth.jwtRefreshSecret }).toEqual(auth);
    expect(initializeAuthenticationKeys({})).toMatchObject({
      jwtAccessExpiry: '7d',
      jwtRefreshExpiry: '30d',
    });
  });

  it('rotates login material without changing policy or expiry', () => {
    const rotated = rotateAuthenticationKeys(auth);
    for (const field of ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret'] as const) {
      expect(rotated[field]).not.toBe(auth[field]);
      expect(rotated[field]).toBeTruthy();
    }
    expect({
      ...rotated,
      jwtSecret: auth.jwtSecret,
      jwtRefreshSecret: auth.jwtRefreshSecret,
      sessionSecret: auth.sessionSecret,
    }).toEqual(auth);
  });

  it('keeps existing VAPID keys during initialization and retains hooks during explicit rotation', () => {
    expect(initializeNotificationKeys(notification)).toEqual(notification);
    const rotated = rotateNotificationKeys(notification);
    expect(rotated.vapidPublicKey).not.toBe(notification.vapidPublicKey);
    expect(rotated.vapidPrivateKey).not.toBe(notification.vapidPrivateKey);
    expect(rotated.adminHooks).toEqual(notification.adminHooks);
  });

  it('accepts only the two explicit rotation scopes', () => {
    expect(isSecurityKeyRotationScope('authentication')).toBe(true);
    expect(isSecurityKeyRotationScope('all')).toBe(true);
    expect(isSecurityKeyRotationScope('vapid')).toBe(false);
    expect(isSecurityKeyRotationScope(null)).toBe(false);
  });
});
