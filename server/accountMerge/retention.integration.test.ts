import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  createOAuthMergeFixture,
  oauthMergeDatabaseUrl,
  testProvider,
  type OAuthMergeFixture,
} from './integrationFixture';

const databaseDescribe = oauthMergeDatabaseUrl ? describe : describe.skip;

databaseDescribe('OAuth merge authorization storage and retention', () => {
  let fixture: OAuthMergeFixture;
  beforeAll(async () => {
    fixture = await createOAuthMergeFixture();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('bounds cleanup to one hundred expired rows and also cleans on a rejected confirmation', async () => {
    const targetUserId = await fixture.makeUser();
    const rows = Array.from({ length: 205 }, () => ({
      targetUserId,
      sourceUserId: randomUUID(),
      sourceBindingId: randomUUID(),
      provider: testProvider,
      providerId: randomUUID(),
      expiresAt: new Date(0),
    }));
    await fixture.db.insert(fixture.schema.oauthMergeAuthorizations).values(rows);
    const { cleanupOAuthMergeAuthorizations } = await import('./retention');
    expect(await cleanupOAuthMergeAuthorizations()).toBe(100);
    const count = async () =>
      (
        await fixture.db
          .select()
          .from(fixture.schema.oauthMergeAuthorizations)
          .where(
            fixture.operators.eq(fixture.schema.oauthMergeAuthorizations.targetUserId, targetUserId)
          )
      ).length;
    expect(await count()).toBe(105);
    const missing = {
      targetUserId,
      sourceUserId: randomUUID(),
      provider: testProvider,
      providerId: 'unknown',
    };
    expect((await fixture.requestMerge(missing)).status).toBe(403);
    expect(await count()).toBe(5);
    expect(await cleanupOAuthMergeAuthorizations()).toBe(5);
    expect(await count()).toBe(0);
  });

  it('skips a locked expired authorization instead of blocking an active transaction', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    const table = fixture.schema.oauthMergeAuthorizations;
    await fixture.db
      .update(table)
      .set({ expiresAt: new Date(0) })
      .where(fixture.operators.eq(table.targetUserId, identity.targetUserId));
    let ready!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transaction = fixture.db.transaction(async (tx) => {
      await tx
        .select()
        .from(table)
        .where(fixture.operators.eq(table.targetUserId, identity.targetUserId))
        .for('update');
      ready();
      await held;
    });
    await locked;
    try {
      const { cleanupOAuthMergeAuthorizations } = await import('./retention');
      expect(await cleanupOAuthMergeAuthorizations()).toBe(0);
      expect(await fixture.grant(identity)).not.toBeNull();
    } finally {
      release();
      await transaction;
    }
    expect((await fixture.requestMerge(identity)).status).toBe(403);
  });

  it('retains completed receipts for twenty-four hours and cascades them only with the destination', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    expect((await fixture.requestMerge(identity)).status).toBe(200);
    const table = fixture.schema.oauthMergeAuthorizations;
    await fixture.db
      .update(table)
      .set({ expiresAt: new Date(0), completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000) })
      .where(fixture.operators.eq(table.targetUserId, identity.targetUserId));
    const { cleanupOAuthMergeAuthorizations } = await import('./retention');
    expect(await cleanupOAuthMergeAuthorizations()).toBe(0);
    expect((await fixture.requestMerge(identity)).status).toBe(200);
    await fixture.db
      .delete(fixture.schema.users)
      .where(fixture.operators.eq(fixture.schema.users.id, identity.targetUserId));
    expect(await fixture.grant(identity)).toBeNull();
  });

  it('enforces unique authorization identity and consistent completed receipt state in PostgreSQL', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    const grant = (await fixture.grant(identity))!;
    await expect(
      Promise.resolve(fixture.db.insert(fixture.schema.oauthMergeAuthorizations).values(grant))
    ).rejects.toThrow();
    await expect(
      Promise.resolve(
        fixture.db
          .update(fixture.schema.oauthMergeAuthorizations)
          .set({ completedAt: new Date() })
          .where(
            fixture.operators.eq(
              fixture.schema.oauthMergeAuthorizations.targetUserId,
              identity.targetUserId
            )
          )
      )
    ).rejects.toThrow();
    expect((await fixture.grant(identity))?.completedAt).toBeNull();
  });
});
