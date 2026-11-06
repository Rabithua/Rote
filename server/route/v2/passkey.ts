import {
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { LastLoginMethodError } from '../../authentication/loginMethods';
import { users, userPasskeys, type User } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  createUserPasskey,
  deleteUserPasskey,
  getPasskeyByCredentialId,
  getUserPasskeys,
  updatePasskeyCounter,
} from '../../utils/dbMethods';
import { oneUser } from '../../utils/dbMethods/user';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { createResponse, sanitizeUserData } from '../../utils/main';
import { UsernameZod } from '../../utils/zod';
import db from '../../utils/drizzle';
import messages from '../../authentication/messages.json';
import { AuthenticationPolicyError, readAuthenticationPolicy } from '../../authentication/policy';
import {
  consumePasskeyChallenge,
  createPasskeyAuthenticationOptions,
  getPasskeyConfig,
  storePasskeyChallenge,
} from '../../authentication/passkeyAuthentication';
import { createPasskeyRegistrationOptions } from '../../authentication/passkeyRegistrationOptions';
import { UserIdentityConflict } from '../../utils/dbMethods/user';

const passkeyRouter = new Hono<{ Variables: HonoVariables }>();

passkeyRouter.onError((error, c) => {
  if (error instanceof AuthenticationPolicyError) {
    return c.json(
      { ...createResponse(null, error.message, error.status), errorCode: error.code },
      error.status
    );
  }
  if (error instanceof UserIdentityConflict) {
    return c.json(
      { ...createResponse(null, error.message, 409), errorCode: 'username_unavailable' },
      409
    );
  }
  throw error;
});

// GET /config - public endpoint to check if passkeys are enabled
passkeyRouter.get('/config', async (c: HonoContext) => {
  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);
  return c.json(createResponse({ enabled: config.enabled, rpName: config.rpName }), 200);
});

// POST /register/options - generate registration options (requires JWT)
passkeyRouter.post('/register/options', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);
  if (!config.enabled) {
    return c.json(createResponse(null, 'Passkeys are disabled', 403), 403);
  }

  // Get user's existing credential IDs to exclude
  const existingPasskeys = await getUserPasskeys(user.id);
  const excludeCredentials = existingPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: (pk.transports as AuthenticatorTransportFuture[]) || [],
  }));

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: user.email || user.username,
    userDisplayName: user.nickname || user.username,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  // Store challenge keyed by userId
  storePasskeyChallenge(`reg:${user.id}`, options.challenge);

  return c.json(createResponse({ options }), 200);
});

// POST /register/verify - verify registration and store credential (requires JWT)
passkeyRouter.post('/register/verify', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { credential, deviceName } = body as {
    credential: RegistrationResponseJSON;
    deviceName?: string;
  };

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);

  const pending = consumePasskeyChallenge(`reg:${user.id}`);
  if (!pending) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: pending.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return c.json(createResponse(null, 'Registration verification failed', 400), 400);
  }

  const { credential: regCredential } = verification.registrationInfo;

  await createUserPasskey({
    userid: user.id,
    credentialId: regCredential.id,
    publicKey: Buffer.from(regCredential.publicKey),
    counter: regCredential.counter,
    transports: credential.response?.transports as string[] | undefined,
    deviceName: deviceName || '',
  });

  return c.json(createResponse(null, 'Passkey registered successfully'), 200);
});

// One username continues an existing account or prepares a new account's passkey.
passkeyRouter.post('/continue/options', async (c: HonoContext) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ...createResponse(null, messages.usernameInvalid, 400), errorCode: 'username_invalid' },
      400
    );
  }
  // Existing provider-generated usernames predate the shorter signup limit.
  const input = z.object({ username: z.string().min(1).max(100) }).safeParse(body);
  const username = input.success ? input.data.username : null;
  if (username === null) {
    return c.json(
      {
        ...createResponse(null, messages.usernameInvalid, 400),
        errorCode: 'username_invalid',
      },
      400
    );
  }
  const policy = await db.transaction(readAuthenticationPolicy);
  if (policy.security?.passkey?.enabled === false)
    throw new AuthenticationPolicyError('passkey_disabled');
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) {
    if (!UsernameZod.safeParse(username).success) {
      return c.json(
        { ...createResponse(null, messages.usernameInvalid, 400), errorCode: 'username_invalid' },
        400
      );
    }
    const registration = await createPasskeyRegistrationOptions(
      username,
      policy,
      c.req.header('origin')
    );
    return c.json(createResponse({ method: 'register', ...registration }), 200);
  }
  const credentials = await db
    .select({ credentialId: userPasskeys.credentialId, transports: userPasskeys.transports })
    .from(userPasskeys)
    .where(eq(userPasskeys.userid, user.id));
  if (!credentials.length) {
    return c.json(
      {
        ...createResponse(null, messages.passkeyNotAvailable, 409),
        errorCode: 'passkey_not_available',
      },
      409
    );
  }
  const authentication = await createPasskeyAuthenticationOptions(c.req.header('origin'), {
    id: user.id,
    credentials,
  });
  return c.json(createResponse({ method: 'authenticate', ...authentication }), 200);
});

// Older clients may still ask for discoverable credentials without entering a username.
passkeyRouter.post('/authenticate/options', async (c: HonoContext) =>
  c.json(createResponse(await createPasskeyAuthenticationOptions(c.req.header('origin'))), 200)
);

// POST /authenticate/verify - verify authentication and return JWT tokens (public)
passkeyRouter.post('/authenticate/verify', async (c: HonoContext) => {
  const body = await c.req.json();
  const { credential, challengeKey } = body as {
    credential: AuthenticationResponseJSON;
    challengeKey: string;
  };

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);

  const pending = consumePasskeyChallenge(`auth:${challengeKey}`);
  if (!pending) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }

  if (!config.enabled) throw new AuthenticationPolicyError('passkey_disabled');

  // Look up the passkey by credential ID
  const passkey = await getPasskeyByCredentialId(credential.id);
  if (!passkey) {
    return c.json(createResponse(null, 'Passkey not found', 404), 404);
  }

  if (pending.userId && passkey.userid !== pending.userId) {
    return c.json(
      {
        ...createResponse(null, messages.passkeyVerificationFailed, 400),
        errorCode: 'passkey_verification_failed',
      },
      400
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: pending.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: (passkey.transports as AuthenticatorTransportFuture[]) || [],
    },
  });

  if (!verification.verified) {
    return c.json(createResponse(null, 'Authentication verification failed', 400), 400);
  }

  // Update counter
  await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

  // Get the user
  const user = await oneUser(passkey.userid);
  if (!user) {
    return c.json(createResponse(null, 'User not found', 404), 404);
  }

  // Generate JWT tokens (same as password login)
  const accessToken = await generateAccessToken({
    userId: user.id,
    username: user.username,
  });
  const refreshToken = await generateRefreshToken({
    userId: user.id,
    username: user.username,
  });

  return c.json(
    createResponse(
      {
        user: sanitizeUserData(user),
        accessToken,
        refreshToken,
      },
      'Passkey authentication successful'
    ),
    200
  );
});

// GET / - list user's passkeys (requires JWT)
passkeyRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const passkeys = await getUserPasskeys(user.id);
  return c.json(createResponse(passkeys), 200);
});

// DELETE /:id - delete passkey (requires JWT)
passkeyRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  try {
    await deleteUserPasskey(id, user.id);
  } catch (error) {
    if (error instanceof LastLoginMethodError) {
      return c.json(createResponse(null, error.message, 400), 400);
    }
    throw error;
  }
  return c.json(createResponse(null, 'Passkey deleted successfully'), 200);
});

export default passkeyRouter;
