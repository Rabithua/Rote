import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { users, userPasskeys } from '../../drizzle/schema';
import type { SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { notifyUserRegistered } from '../../utils/adminHooks';
import { trackBackgroundTask } from '../../utils/backgroundTask';
import { getConfig } from '../../utils/config';
import db from '../../utils/drizzle';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { PasskeyRegisterDataZod } from '../../utils/zod';
import { UserIdentityConflict } from '../../utils/dbMethods/user';
import {
  consumePasskeyRegistration,
  createPasskeyRegistrationOptions,
} from '../../authentication/passkeyRegistrationOptions';
import messages from '../../authentication/messages.json';
import {
  AuthenticationPolicyError,
  readAuthenticationPolicy,
  requireAccountRegistration,
} from '../../authentication/policy';

const passkeyRegistrationRouter = new Hono<{ Variables: HonoVariables }>();

passkeyRegistrationRouter.onError((error, c) => {
  if (error instanceof UserIdentityConflict) {
    return c.json(
      { ...createResponse(null, error.message, 409), errorCode: 'username_unavailable' },
      409
    );
  }
  if (!(error instanceof AuthenticationPolicyError)) throw error;
  return c.json(
    { ...createResponse(null, error.message, error.status), errorCode: error.code },
    error.status
  );
});

// 无密码注册 - Step 1: 验证用户数据，生成 passkey 注册 options
passkeyRegistrationRouter.post('/options', async (c: HonoContext) => {
  const policy = await db.transaction(readAuthenticationPolicy);
  requireAccountRegistration(policy, 'passkey');
  const parsed = PasskeyRegisterDataZod.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      {
        ...createResponse(null, parsed.error.issues[0].message, 400),
        errorCode: 'username_invalid',
      },
      400
    );
  }
  const result = await createPasskeyRegistrationOptions(
    parsed.data.username,
    policy,
    c.req.header('origin')
  );
  return c.json(createResponse(result), 200);
});

// 无密码注册 - Step 2: 验证 passkey，创建账号
passkeyRegistrationRouter.post('/verify', async (c: HonoContext) => {
  const policy = await db.transaction(readAuthenticationPolicy);
  requireAccountRegistration(policy, 'passkey');
  const securityConfig = policy.security;

  const body = await c.req.json();
  const { credential, registrationToken, deviceName } = body as {
    credential: RegistrationResponseJSON;
    registrationToken: string;
    deviceName?: string;
  };

  const pending = consumePasskeyRegistration(registrationToken);
  if (!pending) {
    return c.json(
      {
        ...createResponse(null, messages.registrationExpired, 400),
        errorCode: 'registration_expired',
      },
      400
    );
  }

  // Get passkey config for origin/RP verification
  const origin = c.req.header('origin');
  const siteConfig = await getConfig<SiteConfig>('site');
  const passkeyCfg = securityConfig?.passkey;
  const frontendUrl = origin || siteConfig?.frontendUrl || 'http://localhost:3001';
  const url = new URL(frontendUrl);
  const rpId = passkeyCfg?.rpId || url.hostname;
  const expectedOrigin = passkeyCfg?.origin || frontendUrl;

  // Verify passkey
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: pending.challenge,
    expectedOrigin,
    expectedRPID: rpId,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return c.json(
      {
        ...createResponse(null, messages.passkeyVerificationFailed, 400),
        errorCode: 'passkey_verification_failed',
      },
      400
    );
  }

  const { credential: regCredential } = verification.registrationInfo;
  const { userData } = pending;

  // Create user + passkey atomically in a transaction
  const result = await db
    .transaction(async (tx) => {
      const currentPolicy = await readAuthenticationPolicy(tx);
      requireAccountRegistration(currentPolicy, 'passkey');
      // Create user (no password)
      const [user] = await tx
        .insert(users)
        .values({
          id: userData.tempUserId,
          username: userData.username,
          email: null,
          nickname: userData.username,
          passwordhash: null,
          salt: null,
          role: currentPolicy.ui?.defaultUserRole || 'user',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Create passkey
      const [passkey] = await tx
        .insert(userPasskeys)
        .values({
          userid: user.id,
          credentialId: regCredential.id,
          publicKey: Buffer.from(regCredential.publicKey),
          counter: regCredential.counter,
          transports: credential.response?.transports as string[] | undefined,
          deviceName: deviceName || '',
        })
        .returning();

      return { user, passkey };
    })
    .catch(
      (error: {
        code?: string;
        constraint_name?: string;
        cause?: { code?: string; constraint_name?: string };
      }) => {
        const constraintError = error.cause || error;
        if (
          constraintError.code === '23505' &&
          constraintError.constraint_name === 'users_username_unique'
        ) {
          return null;
        }
        throw error;
      }
    );
  if (!result) {
    return c.json(
      {
        ...createResponse(null, messages.usernameUnavailable, 409),
        errorCode: 'username_unavailable',
      },
      409
    );
  }

  trackBackgroundTask(notifyUserRegistered(result.user), 'admin_hook_user_registered_failed');

  // Generate JWT tokens
  const accessToken = await generateAccessToken({
    userId: result.user.id,
    username: result.user.username,
  });
  const refreshToken = await generateRefreshToken({
    userId: result.user.id,
    username: result.user.username,
  });

  return c.json(
    createResponse({
      user: sanitizeUserData(result.user),
      accessToken,
      refreshToken,
    }),
    201
  );
});

export default passkeyRegistrationRouter;
