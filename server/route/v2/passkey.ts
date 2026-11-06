import crypto from 'crypto';
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
import type { SecurityConfig, SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig, getGlobalConfig } from '../../utils/config';
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

const passkeyRouter = new Hono<{ Variables: HonoVariables }>();

// In-memory challenge store with 2-minute TTL
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

function storeChallenge(key: string, challenge: string) {
  // Clean up expired entries periodically
  if (challengeStore.size > 1000) {
    const now = Date.now();
    for (const [k, v] of challengeStore) {
      if (now > v.expiresAt) challengeStore.delete(k);
    }
  }
  challengeStore.set(key, { challenge, expiresAt: Date.now() + 120_000 });
}

function getAndDeleteChallenge(key: string): string | null {
  const entry = challengeStore.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    challengeStore.delete(key);
    return null;
  }
  challengeStore.delete(key);
  return entry.challenge;
}

// Resolve passkey RP config from site config
async function getPasskeyConfig(requestOrigin?: string) {
  const siteConfig = await getConfig<SiteConfig>('site');
  const securityConfig = getGlobalConfig<SecurityConfig>('security');
  const passkeyConfig = securityConfig?.passkey;

  // Use the actual request origin if provided (browser's Origin header)
  // This handles cases where user accesses via localhost but frontendUrl is configured differently
  const frontendUrl = requestOrigin || siteConfig?.frontendUrl || 'http://localhost:3001';
  const url = new URL(frontendUrl);

  const rpId = passkeyConfig?.rpId || url.hostname;

  return {
    enabled: passkeyConfig?.enabled !== false,
    rpName: passkeyConfig?.rpName || siteConfig?.name || 'Rote',
    rpId,
    origin: passkeyConfig?.origin || frontendUrl,
  };
}

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
  storeChallenge(`reg:${user.id}`, options.challenge);

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

  const expectedChallenge = getAndDeleteChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
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

// POST /authenticate/options - generate authentication options (public)
passkeyRouter.post('/authenticate/options', async (c: HonoContext) => {
  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);
  if (!config.enabled) {
    return c.json(createResponse(null, 'Passkeys are disabled', 403), 403);
  }

  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: 'required',
    // allowCredentials: [] allows discoverable credentials (passkeys without username)
  });

  // Store challenge with a random key (returned to client for verify)
  const challengeKey = crypto.randomUUID();
  storeChallenge(`auth:${challengeKey}`, options.challenge);

  return c.json(createResponse({ options, challengeKey }), 200);
});

// POST /authenticate/verify - verify authentication and return JWT tokens (public)
passkeyRouter.post('/authenticate/verify', async (c: HonoContext) => {
  const body = await c.req.json();
  const { credential, challengeKey } = body as {
    credential: AuthenticationResponseJSON;
    challengeKey: string;
  };

  const origin = c.req.header('origin');
  const config = await getPasskeyConfig(origin || undefined);

  const expectedChallenge = getAndDeleteChallenge(`auth:${challengeKey}`);
  if (!expectedChallenge) {
    return c.json(createResponse(null, 'Challenge expired or not found', 400), 400);
  }

  // Look up the passkey by credential ID
  const passkey = await getPasskeyByCredentialId(credential.id);
  if (!passkey) {
    return c.json(createResponse(null, 'Passkey not found', 404), 404);
  }

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge,
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
