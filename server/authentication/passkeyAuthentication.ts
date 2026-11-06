import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import type { SecurityConfig, SiteConfig } from '../types/config';
import { getConfig } from '../utils/config';
import db from '../utils/drizzle';
import { AuthenticationPolicyError, readAuthenticationPolicy } from './policy';

interface PasskeyChallenge {
  challenge: string;
  expiresAt: number;
  userId?: string;
}

const challenges = new Map<string, PasskeyChallenge>();

export function storePasskeyChallenge(key: string, challenge: string, userId?: string) {
  if (challenges.size > 1000) {
    const now = Date.now();
    for (const [storedKey, entry] of challenges) {
      if (now > entry.expiresAt) challenges.delete(storedKey);
    }
  }
  challenges.set(key, { challenge, userId, expiresAt: Date.now() + 120_000 });
}

export function consumePasskeyChallenge(key: string): PasskeyChallenge | null {
  const entry = challenges.get(key);
  challenges.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry : null;
}

export async function getPasskeyConfig(requestOrigin?: string, security?: SecurityConfig | null) {
  const [site, policy] = await Promise.all([
    getConfig<SiteConfig>('site'),
    security === undefined ? db.transaction(readAuthenticationPolicy) : null,
  ]);
  const passkey = (security === undefined ? policy?.security : security)?.passkey;
  const frontendUrl = requestOrigin || site?.frontendUrl || 'http://localhost:3001';
  const url = new URL(frontendUrl);
  return {
    enabled: passkey?.enabled !== false,
    rpName: passkey?.rpName || site?.name || 'Rote',
    rpId: passkey?.rpId || url.hostname,
    origin: passkey?.origin || frontendUrl,
  };
}

export async function createPasskeyAuthenticationOptions(
  requestOrigin?: string,
  account?: {
    id: string;
    credentials: { credentialId: string; transports: unknown }[];
  }
) {
  const config = await getPasskeyConfig(requestOrigin);
  if (!config.enabled) throw new AuthenticationPolicyError('passkey_disabled');
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: 'required',
    ...(account && {
      allowCredentials: account.credentials.map((credential) => ({
        id: credential.credentialId,
        transports: Array.isArray(credential.transports)
          ? (credential.transports as AuthenticatorTransportFuture[])
          : [],
      })),
    }),
  });
  const challengeKey = crypto.randomUUID();
  storePasskeyChallenge(`auth:${challengeKey}`, options.challenge, account?.id);
  return { options, challengeKey };
}
