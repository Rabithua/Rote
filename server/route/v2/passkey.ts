import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { LastLoginMethodError } from '../../authentication/loginMethods';
import type { User } from '../../drizzle/schema';
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
import { AuthenticationPolicyError } from '../../authentication/policy';
import { generateDeleteGrantToken } from '../../oauthAccounts/deleteConfirm';
import {
  consumePasskeyChallenge,
  createPasskeyAuthenticationOptions,
  getPasskeyConfig,
  storePasskeyChallenge,
} from '../../authentication/passkeyAuthentication';

const passkeyRouter = new Hono<{ Variables: HonoVariables }>();

passkeyRouter.onError((error, c) => {
  if (error instanceof AuthenticationPolicyError) {
    return c.json(
      { ...createResponse(null, error.message, error.status), errorCode: error.code },
      error.status
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

// POST /authenticate/options - discover existing credentials without a username
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

// POST /delete/options - deletion-confirmation options scoped to the current user's passkeys
passkeyRouter.post('/delete/options', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);
  if (!config.enabled) {
    return c.json(createResponse(null, 'Passkeys are disabled', 403), 403);
  }

  const existingPasskeys = await getUserPasskeys(user.id);
  if (existingPasskeys.length === 0) {
    return c.json(createResponse(null, 'No passkey registered', 400), 400);
  }

  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: 'required',
    allowCredentials: existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: (pk.transports as AuthenticatorTransportFuture[]) || [],
    })),
  });

  // Challenge scoped to the current user; the verify step re-checks ownership.
  storePasskeyChallenge(`delete:${user.id}`, options.challenge);

  return c.json(createResponse({ options, challengeKey: user.id }), 200);
});

// POST /delete/verify - verify the assertion and issue a deletion grant
passkeyRouter.post('/delete/verify', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { credential, challengeKey } = body as {
    credential: AuthenticationResponseJSON;
    challengeKey: string;
  };

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);
  if (!config.enabled) {
    return c.json(createResponse(null, 'Passkeys are disabled', 403), 403);
  }

  if (challengeKey !== user.id) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }
  const pending = consumePasskeyChallenge(`delete:${user.id}`);
  if (!pending) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }

  const passkey = await getPasskeyByCredentialId(credential.id);
  if (!passkey || passkey.userid !== user.id) {
    return c.json(createResponse(null, 'Passkey not found', 404), 404);
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

  await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

  const deleteGrant = await generateDeleteGrantToken(user.id);
  return c.json(createResponse({ deleteGrant }, 'Passkey deletion confirmation successful'), 200);
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
