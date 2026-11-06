import crypto from 'crypto';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { SiteConfig } from '../types/config';
import { getConfig } from '../utils/config';
import db from '../utils/drizzle';
import { AuthenticationPolicyError, readAuthenticationPolicy } from './policy';

interface PasskeyChallenge {
  challenge: string;
  expiresAt: number;
}

const challenges = new Map<string, PasskeyChallenge>();

export function storePasskeyChallenge(key: string, challenge: string) {
  if (challenges.size > 1000) {
    const now = Date.now();
    for (const [storedKey, entry] of challenges) {
      if (now > entry.expiresAt) challenges.delete(storedKey);
    }
  }
  challenges.set(key, { challenge, expiresAt: Date.now() + 120_000 });
}

export function consumePasskeyChallenge(key: string): PasskeyChallenge | null {
  const entry = challenges.get(key);
  challenges.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry : null;
}

export async function getPasskeyConfig(requestOrigin?: string) {
  const [site, policy] = await Promise.all([
    getConfig<SiteConfig>('site'),
    db.transaction(readAuthenticationPolicy),
  ]);
  const passkey = policy.security?.passkey;
  const frontendUrl = requestOrigin || site?.frontendUrl || 'http://localhost:3001';
  const url = new URL(frontendUrl);
  return {
    enabled: passkey?.enabled !== false,
    rpName: passkey?.rpName || site?.name || 'Rote',
    rpId: passkey?.rpId || url.hostname,
    origin: passkey?.origin || frontendUrl,
  };
}

export async function createPasskeyAuthenticationOptions(requestOrigin?: string) {
  const config = await getPasskeyConfig(requestOrigin);
  if (!config.enabled) throw new AuthenticationPolicyError('passkey_disabled');
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: 'required',
  });
  const challengeKey = crypto.randomUUID();
  storePasskeyChallenge(`auth:${challengeKey}`, options.challenge);
  return { options, challengeKey };
}
