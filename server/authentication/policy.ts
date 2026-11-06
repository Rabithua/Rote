import { asc, inArray } from 'drizzle-orm';
import { settings } from '../drizzle/schema';
import type { SecurityConfig, UiConfig } from '../types/config';
import type db from '../utils/drizzle';
import messages from './messages.json';

export type AuthenticationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AuthenticationPolicy {
  ui: UiConfig | null;
  security: SecurityConfig | null;
}

// Authorization decisions use committed policy, not another process's configuration cache.
// Stable shared row locks keep policy valid until the credential mutation commits.
export async function readAuthenticationPolicy(
  transaction: AuthenticationTransaction
): Promise<AuthenticationPolicy> {
  const rows = await transaction
    .select({ group: settings.group, config: settings.config })
    .from(settings)
    .where(inArray(settings.group, ['security', 'ui']))
    .orderBy(asc(settings.group))
    .for('share');
  return {
    ui: (rows.find((row) => row.group === 'ui')?.config as unknown as UiConfig) || null,
    security:
      (rows.find((row) => row.group === 'security')?.config as unknown as SecurityConfig) || null,
  };
}

export class AuthenticationPolicyError extends Error {
  readonly status: 400 | 403;
  constructor(readonly code: 'registration_disabled' | 'passkey_disabled') {
    super(
      code === 'registration_disabled' ? messages.registrationDisabled : messages.passkeyDisabled
    );
    this.name = 'AuthenticationPolicyError';
    this.status = code === 'registration_disabled' ? 403 : 400;
  }
}

export function requireAccountRegistration(policy: AuthenticationPolicy) {
  if (policy.ui?.allowRegistration === false)
    throw new AuthenticationPolicyError('registration_disabled');
}
