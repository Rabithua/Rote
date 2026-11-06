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
let registration: typeof import('../route/v2/authPasskeyRegistration').default;

const security = {
  jwtSecret: 'continuation-test-access',
  jwtRefreshSecret: 'continuation-test-refresh',
  sessionSecret: 'continuation-test-state',
  passkey: { enabled: true, rpId: 'localhost', origin: 'http://localhost:3001' },
};

function request(router: typeof passkeys, path: string, body: unknown) {
  return router.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3001' },
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

async function createAccount(username: string) {
  const result = await request(passkeys, '/continue/options', { username });
  expect(result.status).toBe(200);
  const { data } = await result.json();
  expect(data.method).toBe('register');
  const device = authenticator();
  const verified = await request(registration, '/verify', {
    registrationToken: data.registrationToken,
    credential: device.registration(data.options.challenge),
  });
  expect(verified.status).toBe(201);
  return { device, data: (await verified.json()).data };
}

suite('unified Passkey continuation', () => {
  beforeAll(async () => {
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/rote_auth_registration_test')
      throw new Error('Use the isolated rote_auth_registration_test database');
    process.env.POSTGRESQL_URL = databaseUrl;
    database = await import('../utils/drizzle');
    schema = await import('../drizzle/schema');
    ({ setConfig } = await import('../utils/config'));
    ({ default: passkeys } = await import('../route/v2/passkey'));
    ({ default: registration } = await import('../route/v2/authPasskeyRegistration'));
    await setConfig('site', { name: 'Continuation Test', frontendUrl: 'http://localhost:3001' });
  });
  beforeEach(async () => {
    await database.default.delete(schema.users).where(like(schema.users.username, 'continued-%'));
    await setConfig('ui', { allowRegistration: true, defaultUserRole: 'user' });
    await setConfig('security', security);
  });
  afterAll(async () => {
    await database.default.delete(schema.users).where(like(schema.users.username, 'continued-%'));
    await database.closeDatabase();
  });

  it('prepares new usernames without creating an account until registration verifies', async () => {
    const response = await request(passkeys, '/continue/options', { username: 'continued-new' });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.method).toBe('register');
    expect(data.options.user.name).toBe('continued-new');
    expect(
      await database.default
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, 'continued-new'))
    ).toHaveLength(0);
    const device = authenticator();
    const verified = await request(registration, '/verify', {
      registrationToken: data.registrationToken,
      credential: device.registration(data.options.challenge),
    });
    expect(verified.status).toBe(201);
    expect((await verified.json()).data.user.email).toBeNull();
  });

  it('rejects malformed continuation JSON as a client input error', async () => {
    const result = await passkeys.request('/continue/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(result.status).toBe(400);
    expect((await result.json()).errorCode).toBe('username_invalid');
  });

  it('authenticates an existing username with its saved credential and real signature', async () => {
    const account = await createAccount('continued-existing');
    const response = await request(passkeys, '/continue/options', {
      username: 'continued-existing',
    });
    const { data } = await response.json();
    expect(data.method).toBe('authenticate');
    expect(
      data.options.allowCredentials.map((credential: { id: string }) => credential.id)
    ).toEqual([account.device.id]);
    const result = await request(passkeys, '/authenticate/verify', {
      challengeKey: data.challengeKey,
      credential: account.device.authentication(data.options.challenge),
    });
    expect(result.status).toBe(200);
    expect((await result.json()).data.user.id).toBe(account.data.user.id);
    expect(
      await database.default
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, 'continued-existing'))
    ).toHaveLength(1);
  });

  it('directs an existing account without Passkeys to another method instead of creating an account', async () => {
    await database.default
      .insert(schema.users)
      .values({ username: 'continued-password', email: null });
    const result = await request(passkeys, '/continue/options', { username: 'continued-password' });
    expect(result.status).toBe(409);
    expect((await result.json()).errorCode).toBe('passkey_not_available');
    expect(
      await database.default
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, 'continued-password'))
    ).toHaveLength(1);
  });

  it('authenticates existing long usernames while applying current limits only to new accounts', async () => {
    const account = await createAccount('continued-long');
    const username = `continued-${'a'.repeat(30)}`;
    await database.default
      .update(schema.users)
      .set({ username })
      .where(eq(schema.users.id, account.data.user.id));
    const { data } = await (await request(passkeys, '/continue/options', { username })).json();
    expect(data.method).toBe('authenticate');
    const result = await request(passkeys, '/authenticate/verify', {
      challengeKey: data.challengeKey,
      credential: account.device.authentication(data.options.challenge),
    });
    expect(result.status).toBe(200);
    expect((await result.json()).data.user.username).toBe(username);
    const unknown = await request(passkeys, '/continue/options', { username: `${username}-new` });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).errorCode).toBe('username_invalid');
  });

  it('binds username-based challenges to the selected account while preserving anonymous sign-in', async () => {
    await createAccount('continued-first');
    const second = await createAccount('continued-second');
    const firstOptions = (
      await (await request(passkeys, '/continue/options', { username: 'continued-first' })).json()
    ).data;
    const wrongAccount = await request(passkeys, '/authenticate/verify', {
      challengeKey: firstOptions.challengeKey,
      credential: second.device.authentication(firstOptions.options.challenge),
    });
    expect(wrongAccount.status).toBe(400);
    expect((await wrongAccount.json()).errorCode).toBe('passkey_verification_failed');

    const anonymous = (await (await request(passkeys, '/authenticate/options', {})).json()).data;
    const result = await request(passkeys, '/authenticate/verify', {
      challengeKey: anonymous.challengeKey,
      credential: second.device.authentication(anonymous.options.challenge),
    });
    expect(result.status).toBe(200);
    expect((await result.json()).data.user.id).toBe(second.data.user.id);
  });

  it('keeps existing Passkeys usable when registration is closed', async () => {
    const account = await createAccount('continued-returning');
    await setConfig('ui', { allowRegistration: false });
    const newAccount = await request(passkeys, '/continue/options', {
      username: 'continued-blocked',
    });
    expect(newAccount.status).toBe(403);
    expect((await newAccount.json()).errorCode).toBe('registration_disabled');
    const existing = (
      await (
        await request(passkeys, '/continue/options', { username: 'continued-returning' })
      ).json()
    ).data;
    expect(existing.method).toBe('authenticate');
    const signedIn = await request(passkeys, '/authenticate/verify', {
      challengeKey: existing.challengeKey,
      credential: account.device.authentication(existing.options.challenge),
    });
    expect(signedIn.status).toBe(200);
  });

  it('rechecks current Passkey policy before accepting a prepared assertion', async () => {
    const account = await createAccount('continued-disabled');
    const options = (
      await (
        await request(passkeys, '/continue/options', { username: 'continued-disabled' })
      ).json()
    ).data;
    await database.default
      .update(schema.settings)
      .set({ config: { ...security, passkey: { ...security.passkey, enabled: false } } })
      .where(eq(schema.settings.group, 'security'));
    const result = await request(passkeys, '/authenticate/verify', {
      challengeKey: options.challengeKey,
      credential: account.device.authentication(options.options.challenge),
    });
    expect(result.status).toBe(400);
    expect((await result.json()).errorCode).toBe('passkey_disabled');
  });
});
