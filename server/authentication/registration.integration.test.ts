import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import crypto from 'crypto';
import { and, eq, like } from 'drizzle-orm';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

const databaseUrl = process.env.AUTH_REGISTRATION_TEST_DATABASE_URL;
if (databaseUrl && new URL(databaseUrl).pathname !== '/rote_auth_registration_test') {
  throw new Error(
    'Authentication integration tests require the isolated rote_auth_registration_test database'
  );
}
type Schema = typeof import('../drizzle/schema');
let users: Schema['users'];
let userPasskeys: Schema['userPasskeys'];
let userOAuthBindings: Schema['userOAuthBindings'];
let settings: Schema['settings'];
let db: typeof import('../utils/drizzle').default;
let closeDatabase: typeof import('../utils/drizzle').closeDatabase;
let setConfig: typeof import('../utils/config').setConfig;
let getGlobalConfig: typeof import('../utils/config').getGlobalConfig;
let authRouter: typeof import('../route/v2/auth').default;
let deleteUserPasskey: typeof import('../utils/dbMethods/userPasskey').deleteUserPasskey;
let unbindOAuthProvider: typeof import('../utils/dbMethods/userOAuth').unbindOAuthProvider;
let getMyProfile: typeof import('../utils/dbMethods/userProfile').getMyProfile;
let clearUserPassword: typeof import('./passwordCredentials').clearUserPassword;
let generateAccessToken: typeof import('../utils/jwt').generateAccessToken;
const suite = databaseUrl ? describe.serial : describe.skip;

const security = {
  jwtSecret: 'identity-test-access',
  jwtRefreshSecret: 'identity-test-refresh',
  sessionSecret: 'identity-test-session',
  oauth: { enabled: true, providers: { github: { enabled: true } } },
  passkey: { enabled: true, rpId: 'localhost', origin: 'http://localhost:3001' },
};

function request(path: string, body: unknown, token?: string) {
  return authRouter.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3001',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function registrationCredential(challenge: string): RegistrationResponseJSON {
  const credentialId = crypto.randomBytes(32);
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
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
  const length = Buffer.alloc(2);
  length.writeUInt16BE(credentialId.length);
  const authenticatorData = Buffer.concat([
    crypto.createHash('sha256').update('localhost').digest(),
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    length,
    credentialId,
    cose,
  ]);
  const attestation = isoCBOR.encode(
    new Map([
      ['fmt', 'none'],
      ['attStmt', new Map()],
      ['authData', authenticatorData],
    ])
  );
  return {
    id: credentialId.toString('base64url'),
    rawId: credentialId.toString('base64url'),
    type: 'public-key',
    response: {
      attestationObject: Buffer.from(attestation).toString('base64url'),
      clientDataJSON: Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge,
          origin: 'http://localhost:3001',
        })
      ).toString('base64url'),
      transports: ['internal'],
    },
    clientExtensionResults: {},
  };
}

async function createCredentialAccount(username: string) {
  const [user] = await db.insert(users).values({ username, email: null }).returning();
  const [passkey] = await db
    .insert(userPasskeys)
    .values({
      userid: user.id,
      credentialId: crypto.randomUUID(),
      publicKey: Buffer.from([1]),
      counter: 0,
    })
    .returning();
  await db
    .insert(userOAuthBindings)
    .values({ userid: user.id, provider: 'github', providerId: user.id });
  return { user, passkey };
}

suite('username-only registration and credential ownership', () => {
  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl!;
    ({ users, userPasskeys, userOAuthBindings, settings } = await import('../drizzle/schema'));
    ({ default: db, closeDatabase } = await import('../utils/drizzle'));
    ({ setConfig, getGlobalConfig } = await import('../utils/config'));
    ({ default: authRouter } = await import('../route/v2/auth'));
    ({ deleteUserPasskey } = await import('../utils/dbMethods/userPasskey'));
    ({ unbindOAuthProvider } = await import('../utils/dbMethods/userOAuth'));
    ({ getMyProfile } = await import('../utils/dbMethods/userProfile'));
    ({ clearUserPassword } = await import('./passwordCredentials'));
    ({ generateAccessToken } = await import('../utils/jwt'));
    await setConfig('site', { name: 'Identity Test', frontendUrl: 'http://localhost:3001' });
  });
  beforeEach(async () => {
    await db.delete(users).where(like(users.username, 'identity-%'));
    await setConfig('ui', { allowRegistration: true, defaultUserRole: 'user' });
    await setConfig('security', security);
  });
  afterAll(async () => {
    await db.delete(users).where(like(users.username, 'identity-%'));
    await closeDatabase();
  });

  it('requires a password for traditional registration even when passkeys are enabled', async () => {
    const result = await request('/register', {
      username: 'identity-legacy',
      email: 'identity@example.test',
    });
    expect(result.status).toBe(400);
    expect(
      (await db.select().from(users).where(eq(users.username, 'identity-legacy'))).length
    ).toBe(0);
  });

  it('defaults a traditional account nickname to its username', async () => {
    const result = await request('/register', {
      username: 'identity-legacy',
      email: 'identity@example.test',
      password: 'identity-password',
    });
    expect(result.status).toBe(201);
    const { data } = await result.json();
    expect(data.user.nickname).toBe('identity-legacy');
    expect(data.user.email).toBe('identity@example.test');
  });

  it('creates a discoverable passkey account with only username after verification', async () => {
    const response = await request('/register/passkey/options', {
      username: 'identity-passkey',
      email: 'ignored@example.test',
      nickname: 'Ignored name',
    });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.options.user.name).toBe('identity-passkey');
    expect(data.options.authenticatorSelection.residentKey).toBe('required');
    expect(
      (await db.select().from(users).where(eq(users.username, 'identity-passkey'))).length
    ).toBe(0);
    const verified = await request('/register/passkey/verify', {
      registrationToken: data.registrationToken,
      credential: registrationCredential(data.options.challenge),
    });
    expect(verified.status).toBe(201);
    const { data: registered } = await verified.json();
    expect(registered.user.email).toBeNull();
    expect(registered.user.nickname).toBe('identity-passkey');
    expect(registered.user.id).toBe(Buffer.from(data.options.user.id, 'base64url').toString());
    expect(
      (await db.select().from(userPasskeys).where(eq(userPasskeys.userid, registered.user.id)))
        .length
    ).toBe(1);
    const replay = await request('/register/passkey/verify', {
      registrationToken: data.registrationToken,
    });
    expect(replay.status).toBe(400);
  });

  it('reports a username claimed after passkey options without leaving a second credential', async () => {
    const response = await request('/register/passkey/options', { username: 'identity-claimed' });
    const { data } = await response.json();
    const [existing] = await db
      .insert(users)
      .values({ username: 'identity-claimed', email: null })
      .returning();
    const verified = await request('/register/passkey/verify', {
      registrationToken: data.registrationToken,
      credential: registrationCredential(data.options.challenge),
    });
    expect(verified.status).toBe(409);
    expect((await verified.json()).errorCode).toBe('username_unavailable');
    expect(
      (await db.select().from(userPasskeys).where(eq(userPasskeys.userid, existing.id))).length
    ).toBe(0);
  });

  it('reports traditional username and email conflicts without a server error', async () => {
    await request('/register', {
      username: 'identity-existing',
      email: 'identity-conflict@example.test',
      password: 'identity-password',
    });
    const usernameConflict = await request('/register', {
      username: 'identity-existing',
      email: 'identity-other@example.test',
      password: 'identity-password',
    });
    expect(usernameConflict.status).toBe(409);
    expect((await usernameConflict.json()).errorCode).toBe('username_unavailable');
    const emailConflict = await request('/register', {
      username: 'identity-other',
      email: 'identity-conflict@example.test',
      password: 'identity-password',
    });
    expect(emailConflict.status).toBe(409);
    expect((await emailConflict.json()).errorCode).toBe('email_unavailable');
  });

  it('rechecks registration policy before committing a pending passkey registration', async () => {
    const response = await request('/register/passkey/options', { username: 'identity-pending' });
    const { data } = await response.json();
    await setConfig('ui', { allowRegistration: false });
    const result = await request('/register/passkey/verify', {
      registrationToken: data.registrationToken,
      credential: registrationCredential(data.options.challenge),
    });
    expect(result.status).toBe(403);
    expect(
      (await db.select().from(users).where(eq(users.username, 'identity-pending'))).length
    ).toBe(0);
  });

  it('allows several accounts without email and keeps the native password-login string contract', async () => {
    const [first] = await db
      .insert(users)
      .values({ username: 'identity-first', email: null })
      .returning();
    await db.insert(users).values({ username: 'identity-second', email: null });
    const accessToken = await generateAccessToken({ userId: first.id, username: first.username });
    const setPassword = await request(
      '/password/set',
      { newpassword: 'identity-password' },
      accessToken
    );
    expect(setPassword.status).toBe(200);
    const login = await request('/login', {
      username: first.username,
      password: 'identity-password',
    });
    expect(login.status).toBe(200);
    expect((await login.json()).data.user.email).toBe('');
    expect((await getMyProfile(first.id)).email).toBeNull();
  });

  it('allows OAuth unlinking with a passkey and protects the remaining last credential', async () => {
    const { user, passkey } = await createCredentialAccount('identity-unlink');
    await unbindOAuthProvider(user.id, 'github');
    await expect(deleteUserPasskey(passkey.id, user.id)).rejects.toThrow('last');
    expect(
      (await db.select().from(userPasskeys).where(eq(userPasskeys.userid, user.id))).length
    ).toBe(1);
  });

  it('serializes concurrent OAuth and passkey removals around the account owner', async () => {
    const { user, passkey } = await createCredentialAccount('identity-race');
    const results = await Promise.allSettled([
      deleteUserPasskey(passkey.id, user.id),
      unbindOAuthProvider(user.id, 'github'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const passkeys = await db.select().from(userPasskeys).where(eq(userPasskeys.userid, user.id));
    const bindings = await db
      .select()
      .from(userOAuthBindings)
      .where(eq(userOAuthBindings.userid, user.id));
    expect(passkeys.length + bindings.length).toBe(1);
  });

  it('rejects registration after another process disables signup without refreshing this cache', async () => {
    await db
      .update(settings)
      .set({ config: { allowRegistration: false } })
      .where(eq(settings.group, 'ui'));
    expect(getGlobalConfig('ui')).toMatchObject({ allowRegistration: true });
    const traditional = await request('/register', {
      username: 'identity-closed',
      email: 'closed@example.test',
      password: 'identity-password',
    });
    const passkey = await request('/register/passkey/options', { username: 'identity-closed' });
    expect(traditional.status).toBe(403);
    expect(passkey.status).toBe(403);
    expect(
      (await db.select().from(users).where(eq(users.username, 'identity-closed'))).length
    ).toBe(0);
  });

  it('rejects a pending passkey after another process disables passkeys', async () => {
    const options = await request('/register/passkey/options', { username: 'identity-stale' });
    const { data } = await options.json();
    await db
      .update(settings)
      .set({ config: { ...security, passkey: { enabled: false } } })
      .where(eq(settings.group, 'security'));
    expect(getGlobalConfig('security')).toMatchObject({ passkey: { enabled: true } });
    const verified = await request('/register/passkey/verify', {
      registrationToken: data.registrationToken,
      credential: registrationCredential(data.options.challenge),
    });
    expect(verified.status).toBe(400);
    expect((await verified.json()).errorCode).toBe('passkey_disabled');
  });

  it('keeps a password when another process disables the only alternate credential', async () => {
    const registered = await request('/register', {
      username: 'identity-cached',
      email: 'cached@example.test',
      password: 'identity-password',
    });
    const userId = (await registered.json()).data.user.id;
    await db.insert(userPasskeys).values({
      userid: userId,
      credentialId: crypto.randomUUID(),
      publicKey: Buffer.from([1]),
      counter: 0,
    });
    await db
      .update(settings)
      .set({ config: { ...security, passkey: { enabled: false } } })
      .where(eq(settings.group, 'security'));
    expect(getGlobalConfig('security')).toMatchObject({ passkey: { enabled: true } });
    await expect(clearUserPassword(userId, 'identity-password')).rejects.toThrow('last');
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.passwordhash).not.toBeNull();
  });

  it('protects a password when all remaining passkeys are disabled', async () => {
    const registered = await request('/register', {
      username: 'identity-disabled',
      email: 'disabled@example.test',
      password: 'identity-password',
    });
    const userId = (await registered.json()).data.user.id;
    await db.insert(userPasskeys).values({
      userid: userId,
      credentialId: crypto.randomUUID(),
      publicKey: Buffer.from([1]),
      counter: 0,
    });
    await setConfig('security', { ...security, passkey: { ...security.passkey, enabled: false } });
    await expect(clearUserPassword(userId, 'identity-password')).rejects.toThrow('last');
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.username, 'identity-disabled')));
    expect(user.passwordhash).not.toBeNull();
  });
});
