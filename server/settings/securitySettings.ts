import { SignJWT } from 'jose';
import type { SecurityConfig, SecuritySettings, SecuritySettingsUpdate } from '../types/config';

const signingKeys = ['jwtSecret', 'jwtRefreshSecret', 'sessionSecret'] as const;
const editableFields = [
  'jwtAccessExpiry',
  'jwtRefreshExpiry',
  'requireCertifiedUserForExplore',
  'requireVerifiedEmailForExplore',
  'oauth',
  'passkey',
] as const;

export class SecuritySettingsError extends Error {
  constructor(
    public readonly code: 'security_signing_keys_not_editable' | 'security_settings_invalid',
    public readonly status: 400 | 403
  ) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new SecuritySettingsError('security_settings_invalid', 400);
}

export function readSecuritySettings(config: unknown): SecuritySettings {
  if (!isRecord(config)) return {} as SecuritySettings;
  return Object.fromEntries(
    editableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(config, field))
      .map((field) => [field, config[field]])
  ) as SecuritySettings;
}

export function parseSecuritySettingsUpdate(value: unknown): SecuritySettingsUpdate {
  if (!isRecord(value)) return invalid();
  if (signingKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new SecuritySettingsError('security_signing_keys_not_editable', 403);
  }
  if (
    Object.keys(value).some(
      (key) => !editableFields.includes(key as (typeof editableFields)[number])
    )
  ) {
    return invalid();
  }
  for (const field of ['jwtAccessExpiry', 'jwtRefreshExpiry'] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    if (typeof value[field] !== 'string' || !value[field]) return invalid();
    try {
      new SignJWT({}).setExpirationTime(value[field]);
    } catch {
      return invalid();
    }
  }
  for (const field of [
    'requireCertifiedUserForExplore',
    'requireVerifiedEmailForExplore',
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(value, field) && typeof value[field] !== 'boolean')
      return invalid();
  }
  if (
    Object.prototype.hasOwnProperty.call(value, 'requireCertifiedUserForExplore') &&
    Object.prototype.hasOwnProperty.call(value, 'requireVerifiedEmailForExplore') &&
    value.requireCertifiedUserForExplore !== value.requireVerifiedEmailForExplore
  )
    return invalid();
  if (Object.prototype.hasOwnProperty.call(value, 'oauth')) {
    if (!isRecord(value.oauth) || typeof value.oauth.enabled !== 'boolean') return invalid();
    if (
      Object.prototype.hasOwnProperty.call(value.oauth, 'providers') &&
      !isRecord(value.oauth.providers)
    )
      return invalid();
  }
  if (Object.prototype.hasOwnProperty.call(value, 'passkey')) {
    if (!isRecord(value.passkey)) return invalid();
    for (const [field, entry] of Object.entries(value.passkey)) {
      if (
        field === 'enabled'
          ? typeof entry !== 'boolean'
          : !['rpId', 'rpName', 'origin'].includes(field) || typeof entry !== 'string'
      ) {
        return invalid();
      }
    }
  }
  return value as SecuritySettingsUpdate;
}

export function mergeSecuritySettings(
  existing: SecurityConfig,
  update: SecuritySettingsUpdate
): SecurityConfig {
  const merged = { ...existing, ...update };
  // Keep the released alias synchronized when either client spelling is submitted.
  if (
    update.requireCertifiedUserForExplore !== undefined ||
    update.requireVerifiedEmailForExplore !== undefined
  ) {
    merged.requireCertifiedUserForExplore =
      update.requireCertifiedUserForExplore ?? update.requireVerifiedEmailForExplore;
    delete merged.requireVerifiedEmailForExplore;
  }
  return merged;
}

export async function validateSecuritySettings(config: SecurityConfig): Promise<void> {
  if (!config.oauth?.enabled || !config.oauth.providers) return;
  const { oauthProviderRegistry } = await import('../utils/oauth/providers');
  for (const [provider, providerConfig] of Object.entries(config.oauth.providers)) {
    if (!providerConfig?.enabled) continue;
    try {
      await oauthProviderRegistry.validateProviderConfig(provider, providerConfig);
      new URL(providerConfig.callbackUrl);
    } catch {
      throw new SecuritySettingsError('security_settings_invalid', 400);
    }
  }
}
