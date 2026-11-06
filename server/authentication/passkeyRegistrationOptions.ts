import crypto from 'crypto';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { UserIdentityConflict } from '../utils/dbMethods/user';
import db from '../utils/drizzle';
import { getPasskeyConfig } from './passkeyAuthentication';
import { requireAccountRegistration, type AuthenticationPolicy } from './policy';

interface PendingRegistration {
  userData: { username: string; tempUserId: string };
  challenge: string;
  expiresAt: number;
}

const pendingRegistrations = new Map<string, PendingRegistration>();

export function consumePasskeyRegistration(token: string) {
  const entry = pendingRegistrations.get(token);
  pendingRegistrations.delete(token);
  return entry && entry.expiresAt > Date.now() ? entry : null;
}

export async function createPasskeyRegistrationOptions(
  username: string,
  policy: AuthenticationPolicy,
  requestOrigin?: string
) {
  requireAccountRegistration(policy, 'passkey');
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing) throw new UserIdentityConflict('username', undefined);

  const tempUserId = crypto.randomUUID();
  const config = await getPasskeyConfig(requestOrigin, policy.security);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userID: new TextEncoder().encode(tempUserId),
    userName: username,
    userDisplayName: username,
    excludeCredentials: [],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  if (pendingRegistrations.size > 500) {
    const now = Date.now();
    for (const [token, pending] of pendingRegistrations) {
      if (pending.expiresAt <= now) pendingRegistrations.delete(token);
    }
  }
  const registrationToken = crypto.randomUUID();
  pendingRegistrations.set(registrationToken, {
    userData: { username, tempUserId },
    challenge: options.challenge,
    expiresAt: Date.now() + 300_000,
  });
  return { options, registrationToken };
}
