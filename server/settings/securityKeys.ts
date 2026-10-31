import type { NotificationConfig, SecurityConfig, SecurityKeyRotationScope } from '../types/config';
import { KeyGenerator } from '../utils/keyGenerator';

export function initializeAuthenticationKeys(existing: Partial<SecurityConfig>): SecurityConfig {
  return {
    ...existing,
    jwtSecret: existing.jwtSecret || KeyGenerator.generateJWTSecret(),
    jwtRefreshSecret: existing.jwtRefreshSecret || KeyGenerator.generateJWTSecret(),
    sessionSecret: existing.sessionSecret || KeyGenerator.generateSessionSecret(),
    jwtAccessExpiry: existing.jwtAccessExpiry || '7d',
    jwtRefreshExpiry: existing.jwtRefreshExpiry || '30d',
  };
}

export function rotateAuthenticationKeys(existing: Partial<SecurityConfig>): SecurityConfig {
  return {
    ...existing,
    jwtSecret: KeyGenerator.generateJWTSecret(),
    jwtRefreshSecret: KeyGenerator.generateJWTSecret(),
    sessionSecret: KeyGenerator.generateSessionSecret(),
    jwtAccessExpiry: existing.jwtAccessExpiry || '7d',
    jwtRefreshExpiry: existing.jwtRefreshExpiry || '30d',
  };
}

export function initializeNotificationKeys(
  existing: Partial<NotificationConfig>
): NotificationConfig {
  if (existing.vapidPublicKey && existing.vapidPrivateKey) return existing as NotificationConfig;
  return rotateNotificationKeys(existing);
}

export function rotateNotificationKeys(existing: Partial<NotificationConfig>): NotificationConfig {
  const keys = KeyGenerator.generateVAPIDKeys();
  return { ...existing, vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey };
}

export function isSecurityKeyRotationScope(value: unknown): value is SecurityKeyRotationScope {
  return value === 'authentication' || value === 'all';
}
