import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import crypto from 'crypto';
import { eq, like } from 'drizzle-orm';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

const databaseUrl = process.env.AUTH_REGISTRATION_TEST_DATABASE_URL;
const suite = databaseUrl ? describe.serial : describe.skip;
let database: typeof import('../utils/drizzle');
let schema: typeof import('../drizzle/schema');
let setConfig: typeof import('../utils/config').setConfig;
let passkeys: typeof import('../route/v2/passkey').default;
let generateAccessToken: typeof import('../utils/jwt').generateAccessToken;

const security = {
  jwtSecret: 'continuation-test-access',
  jwtRefreshSecret: 'continuation-test-refresh',
  sessionSecret: 'continuation-test-state',
  passkey: { enabled: true, rpId: 'localhost', origin: 'http://localhost:3001' },
};

function request(router: typeof passkeys, path: string, body: unknown, token?: string) {
  return router.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3001',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function authenticator() {
  const id = crypto.randomBytes(32);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = isoCBOR.encode(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x!, 'base64url')],
      [-3, Buffer.from(jwk.y!, 'base64url')],
    ])
  );
  let counter = 0;
  const clientData = (type: string, challenge: string) =>
    Buffer.from(
      JSON.stringify({
        type,
        challenge,
        origin: 'http://localhost:3001',
      })
    );
  const authenticatorData = (flags: number) => {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    return Buffer.concat([
      crypto.createHash('sha256').update('localhost').digest(),
      Buffer.from([flags]),
      count,
    ]);
  };
  return {
    id: id.toString('base64url'),
    registration(challenge: string): RegistrationResponseJSON {
      const length = Buffer.alloc(2);
      length.writeUInt16BE(id.length);
      const data = Buffer.concat([authenticatorData(0x45), Buffer.alloc(16), length, id, cose]);
      const attestation = isoCBOR.encode(
        new Map([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', data],
        ])
      );
      return {
        id: id.toString('base64url'),
        rawId: id.toString('base64url'),
        type: 'public-key',
        response: {
          attestationObject: Buffer.from(attestation).toString('base64url'),
          clientDataJSON: clientData('webauthn.create', challenge).toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
      };
    },
    authentication(challenge: string): AuthenticationResponseJSON {
      counter += 1;
      const data = authenticatorData(0x05);
      const client = clientData('webauthn.get', challenge);
      const signature = crypto.sign(
        'sha256',
        Buffer.concat([data, crypto.createHash('sha256').update(client).digest()]),
        privateKey
      );
      return {
        id: id.toString('base64url'),
        rawId: id.toString('base64url'),
        type: 'public-key',
        response: {
          authenticatorData: data.toString('base64url'),
          clientDataJSON: client.toString('base64url'),
          signature: signature.toString('base64url'),
        },
        clientExtensionResults: {},
      };
    },
  };
}

async function existingAccount(username: string) {
  const [user] = await database.default
    .insert(schema.users)
    .values({ username, email: null })
    .returning();
  const accessToken = await generateAccessToken({ userId: user.id, username });
  const response = await request(passkeys, '/register/options', {}, accessToken);
  expect(response.status).toBe(200);
  const { data } = await response.json();
  const device = authenticator();
  const verified = await request(
    passkeys,
    '/register/verify',
    { credential: device.registration(data.options.challenge) },
    accessToken
  );
  expect(verified.status).toBe(200);
  return { device, user };
}

async function authenticationOptions() {
  const response = await request(passkeys, '/authenticate/options', {});
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

suite('Passkey login for existing accounts', () => {
  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/rote_auth_registration_test')
      throw new Error('Use the isolated rote_auth_registration_test database');
    process.env.POSTGRESQL_URL = databaseUrl;
    database = await import('../utils/drizzle');
    schema = await import('../drizzle/schema');
    ({ setConfig } = await import('../utils/config'));
    ({ default: passkeys } = await import('../route/v2/passkey'));
    ({ generateAccessToken } = await import('../utils/jwt'));
    await setConfig('site', { name: 'Passkey Login Test', frontendUrl: 'http://localhost:3001' });
  });
  beforeEach(async () => {
    await database.default
      .delete(schema.users)
      .where(like(schema.users.username, 'passkey-login-%'));
    await setConfig('ui', { allowRegistration: true, defaultUserRole: 'user' });
    await setConfig('security', security);
  });
  afterAll(async () => {
    await database.default
      .delete(schema.users)
      .where(like(schema.users.username, 'passkey-login-%'));
    await database.closeDatabase();
  });

  it('adds a discoverable credential to an authenticated account without creating another account', async () => {
    const account = await existingAccount('passkey-login-existing');
    expect(account.user.email).toBeNull();
    expect(
      await database.default
        .select()
        .from(schema.users)
        .where(like(schema.users.username, 'passkey-login-%'))
    ).toHaveLength(1);
    expect(
      await database.default
        .select()
        .from(schema.userPasskeys)
        .where(eq(schema.userPasskeys.userid, account.user.id))
    ).toHaveLength(1);
  });

  it('discovers and authenticates an existing account without a username using a real signature', async () => {
    const account = await existingAccount('passkey-login-returning');
    const options = await authenticationOptions();
    expect(options.options.allowCredentials ?? []).toEqual([]);
    const response = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: account.device.authentication(options.options.challenge),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.user.id).toBe(account.user.id);
    const [credential] = await database.default
      .select()
      .from(schema.userPasskeys)
      .where(eq(schema.userPasskeys.userid, account.user.id));
    expect(credential.counter).toBe(1);
  });

  it('keeps legacy long usernames usable without asking them to satisfy signup limits', async () => {
    const username = `passkey-login-${'a'.repeat(50)}`;
    const account = await existingAccount(username);
    const options = await authenticationOptions();
    const response = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: account.device.authentication(options.options.challenge),
    });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.user.id).toBe(account.user.id);
    expect(data.user.username).toBe(username);
  });

  it('keeps existing-account enrollment and login available when signup is closed', async () => {
    await setConfig('ui', { allowRegistration: false });
    const account = await existingAccount('passkey-login-closed');
    const options = await authenticationOptions();
    const response = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: account.device.authentication(options.options.challenge),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.user.id).toBe(account.user.id);
  });

  it('rejects an unknown credential instead of creating an account', async () => {
    const options = await authenticationOptions();
    const device = authenticator();
    const response = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: device.authentication(options.options.challenge),
    });
    expect(response.status).toBe(404);
    expect(
      await database.default
        .select()
        .from(schema.users)
        .where(like(schema.users.username, 'passkey-login-%'))
    ).toHaveLength(0);
  });

  it('consumes authentication challenges after a successful sign-in', async () => {
    const account = await existingAccount('passkey-login-replay');
    const options = await authenticationOptions();
    const credential = account.device.authentication(options.options.challenge);
    const body = { challengeKey: options.challengeKey, credential };
    expect((await request(passkeys, '/authenticate/verify', body)).status).toBe(200);
    expect((await request(passkeys, '/authenticate/verify', body)).status).toBe(400);
  });

  it('rechecks current Passkey policy before accepting a prepared assertion', async () => {
    const account = await existingAccount('passkey-login-disabled');
    const options = await authenticationOptions();
    await database.default
      .update(schema.settings)
      .set({ config: { ...security, passkey: { ...security.passkey, enabled: false } } })
      .where(eq(schema.settings.group, 'security'));
    const response = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: account.device.authentication(options.options.challenge),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe('passkey_disabled');
  });
});
