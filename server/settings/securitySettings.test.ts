import { describe, expect, it } from 'bun:test';
import type { SecurityConfig } from '../types/config';
import {
  mergeSecuritySettings,
  parseSecuritySettingsUpdate,
  readSecuritySettings,
} from './securitySettings';

const existing: SecurityConfig = {
  jwtSecret: 'unit-access-key',
  jwtRefreshSecret: 'unit-refresh-key',
  sessionSecret: 'unit-state-key',
  jwtAccessExpiry: '2h',
  jwtRefreshExpiry: '14d',
  requireCertifiedUserForExplore: true,
  oauth: { enabled: false, providers: {} },
  passkey: { enabled: true, rpId: 'example.test' },
};

describe('security settings ownership', () => {
  it('reads only the public settings contract even when storage gains internal fields', () => {
    expect(readSecuritySettings({ ...existing, internalSigningKey: 'private' })).toEqual({
      jwtAccessExpiry: '2h',
      jwtRefreshExpiry: '14d',
      requireCertifiedUserForExplore: true,
      oauth: existing.oauth,
      passkey: existing.passkey,
    });
  });

  it('rejects every explicit signing-key input, including empty and null values', () => {
    for (const field of ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret']) {
      for (const value of ['replacement', '', null, {}, false]) {
        expect(() => parseSecuritySettingsUpdate({ [field]: value })).toThrow(
          'security_signing_keys_not_editable'
        );
      }
    }
  });

  it('requires known fields and their input representation', () => {
    for (const input of [
      null,
      [],
      true,
      'security',
      { unknown: true },
      { requireCertifiedUserForExplore: 'true' },
      { jwtAccessExpiry: 'never' },
      { jwtRefreshExpiry: 123 },
      { oauth: null },
      { oauth: { enabled: 'true' } },
      { oauth: { enabled: true, providers: [] } },
      { passkey: [] },
      { passkey: { enabled: 'true' } },
      { passkey: { rpId: 123 } },
      { passkey: { unknown: 'value' } },
      JSON.parse('{"__proto__":{"jwtSecret":"replacement"}}'),
    ]) {
      expect(() => parseSecuritySettingsUpdate(input)).toThrow('security_settings_invalid');
    }
  });

  it('preserves omitted top-level fields and replaces supplied nested settings', () => {
    const patch = parseSecuritySettingsUpdate({ oauth: { enabled: true, providers: {} } });
    expect(mergeSecuritySettings(existing, patch)).toEqual({
      ...existing,
      oauth: { enabled: true, providers: {} },
    });
    expect(mergeSecuritySettings(existing, {})).toEqual(existing);
  });

  it('normalizes both released policy spellings without retaining an obsolete conflicting value', () => {
    const old = { ...existing, requireVerifiedEmailForExplore: true };
    for (const patch of [
      { requireCertifiedUserForExplore: false },
      { requireVerifiedEmailForExplore: false },
    ]) {
      const saved = mergeSecuritySettings(old, parseSecuritySettingsUpdate(patch));
      expect(saved.requireCertifiedUserForExplore).toBe(false);
      expect(saved.requireVerifiedEmailForExplore).toBeUndefined();
      expect(saved.jwtSecret).toBe(existing.jwtSecret);
    }
    expect(() =>
      parseSecuritySettingsUpdate({
        requireCertifiedUserForExplore: false,
        requireVerifiedEmailForExplore: true,
      })
    ).toThrow('security_settings_invalid');
  });
});
