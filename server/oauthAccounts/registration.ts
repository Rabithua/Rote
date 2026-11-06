import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { readAuthenticationPolicy, type AuthenticationTransaction } from '../authentication/policy';
import { oauthRegistrationAuthorizations } from '../drizzle/oauthRegistrationSchema';
import { userOAuthBindings, users } from '../drizzle/schema';
import type { UiConfig } from '../types/config';
import { notifyUserRegistered } from '../utils/adminHooks';
import { trackBackgroundTask } from '../utils/backgroundTask';
import db from '../utils/drizzle';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import type { OAuthUserInfo } from '../utils/oauth/providers/base';
import { UsernameZod } from '../utils/zod';
import { getOAuthCompletionUrl, type OAuthCompletionContext } from './completion';
import { OAuthRegistrationError } from './registrationError';

const authorizationLifetimeMs = 10 * 60 * 1000;
const registrationTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function tokenDigest(token: string): string {
  if (!registrationTokenPattern.test(token)) {
    throw new OAuthRegistrationError('oauth_registration_expired');
  }
  return createHash('sha256').update(token).digest('hex');
}

async function requireRegistration(
  provider: string,
  transaction?: AuthenticationTransaction
): Promise<UiConfig | null> {
  const { ui, security } = transaction
    ? await readAuthenticationPolicy(transaction)
    : await db.transaction(readAuthenticationPolicy);
  if (ui?.allowRegistration === false) {
    throw new OAuthRegistrationError('registration_disabled');
  }
  if (!security?.oauth?.enabled || !security.oauth.providers?.[provider]?.enabled) {
    throw new OAuthRegistrationError('oauth_disabled');
  }
  return ui;
}

function suggestUsername(provider: string, username: string): string {
  const suggestion = username
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 20);
  if (UsernameZod.safeParse(suggestion).success) return suggestion;
  const prefix =
    provider
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 11) || 'user';
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

export async function beginOAuthRegistration(
  provider: string,
  identity: OAuthUserInfo,
  context: OAuthCompletionContext
): Promise<string> {
  await requireRegistration(provider);
  if (!identity.id) throw new OAuthRegistrationError('oauth_registration_invalid');
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  await db
    .delete(oauthRegistrationAuthorizations)
    .where(lt(oauthRegistrationAuthorizations.expiresAt, now));
  await db.insert(oauthRegistrationAuthorizations).values({
    tokenHash: tokenDigest(token),
    provider,
    providerId: identity.id,
    providerUsername: identity.username || null,
    suggestedUsername: suggestUsername(provider, identity.username || ''),
    avatar: identity.avatar || null,
    ...context,
    expiresAt: new Date(now.getTime() + authorizationLifetimeMs),
  });
  return token;
}

export async function getOAuthRegistrationOptions(token: string) {
  const [authorization] = await db
    .select()
    .from(oauthRegistrationAuthorizations)
    .where(eq(oauthRegistrationAuthorizations.tokenHash, tokenDigest(token)))
    .limit(1);
  if (
    !authorization ||
    authorization.consumedAt ||
    authorization.expiresAt.getTime() <= Date.now()
  ) {
    throw new OAuthRegistrationError('oauth_registration_expired');
  }
  await requireRegistration(authorization.provider);
  return {
    provider: authorization.provider,
    suggestedUsername: authorization.suggestedUsername,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
}

export async function finishOAuthRegistration(token: string, inputUsername: unknown) {
  const username = UsernameZod.safeParse(inputUsername);
  if (!username.success) throw new OAuthRegistrationError('username_invalid');
  const hash = tokenDigest(token);
  let result;
  try {
    result = await db.transaction(async (tx) => {
      const [authorization] = await tx
        .select()
        .from(oauthRegistrationAuthorizations)
        .where(eq(oauthRegistrationAuthorizations.tokenHash, hash))
        .for('update');
      if (
        !authorization ||
        authorization.consumedAt ||
        authorization.expiresAt.getTime() <= Date.now()
      ) {
        throw new OAuthRegistrationError('oauth_registration_expired');
      }
      const ui = await requireRegistration(authorization.provider, tx);
      const [binding] = await tx
        .select({ id: userOAuthBindings.id })
        .from(userOAuthBindings)
        .where(
          and(
            eq(userOAuthBindings.provider, authorization.provider),
            eq(userOAuthBindings.providerId, authorization.providerId)
          )
        );
      if (binding) throw new OAuthRegistrationError('oauth_registration_conflict');
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username.data));
      if (existingUser) throw new OAuthRegistrationError('username_unavailable');

      const [user] = await tx
        .insert(users)
        .values({
          username: username.data,
          nickname: username.data,
          email: null,
          avatar: authorization.avatar,
          role: ui?.defaultUserRole || 'user',
        })
        .returning();
      await tx.insert(userOAuthBindings).values({
        userid: user.id,
        provider: authorization.provider,
        providerId: authorization.providerId,
        providerUsername: authorization.providerUsername,
      });
      await tx
        .update(oauthRegistrationAuthorizations)
        .set({ consumedAt: new Date() })
        .where(eq(oauthRegistrationAuthorizations.tokenHash, hash));
      return { user, authorization };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A competing username or provider registration rolled back this entire transaction.
    const [authorization] = await db
      .select()
      .from(oauthRegistrationAuthorizations)
      .where(eq(oauthRegistrationAuthorizations.tokenHash, hash));
    if (authorization) {
      const [binding] = await db
        .select({ id: userOAuthBindings.id })
        .from(userOAuthBindings)
        .where(
          and(
            eq(userOAuthBindings.provider, authorization.provider),
            eq(userOAuthBindings.providerId, authorization.providerId)
          )
        );
      if (binding) throw new OAuthRegistrationError('oauth_registration_conflict');
    }
    throw new OAuthRegistrationError('username_unavailable');
  }

  trackBackgroundTask(notifyUserRegistered(result.user), 'admin_hook_user_registered_failed');
  const payload = { userId: result.user.id, username: result.user.username };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);
  return {
    user: result.user,
    accessToken,
    refreshToken,
    completionUrl: getOAuthCompletionUrl(result.authorization, result.authorization.provider, {
      accessToken,
      refreshToken,
    }),
  };
}
