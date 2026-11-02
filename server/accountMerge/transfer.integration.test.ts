import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  createOAuthMergeFixture,
  oauthMergeDatabaseUrl,
  type OAuthMergeFixture,
} from './integrationFixture';

const databaseDescribe = oauthMergeDatabaseUrl ? describe : describe.skip;

databaseDescribe('authorized OAuth merge ownership and atomicity', () => {
  let fixture: OAuthMergeFixture;
  beforeAll(async () => {
    fixture = await createOAuthMergeFixture();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('keeps the legacy confirmation contract and transfers stored data without touching media', async () => {
    const identity = await fixture.makePair();
    const { db, schema, operators } = fixture;
    const [note] = await db
      .insert(schema.rotes)
      .values({ authorid: identity.sourceUserId, content: 'private content', state: 'private' })
      .returning();
    const [attachment] = await db
      .insert(schema.attachments)
      .values({
        userid: identity.sourceUserId,
        roteid: note.id,
        url: 'https://media.example.test/original',
        compressUrl: 'https://media.example.test/preview',
        posterUrl: 'https://media.example.test/poster',
        storage: 's3',
        details: { key: 'original', clientMetadata: true },
      })
      .returning();
    const [key] = await db
      .insert(schema.userOpenKeys)
      .values({ userid: identity.sourceUserId })
      .returning();
    const objectKey = `merge-${randomUUID()}`;
    await db.insert(schema.resourceStorageAccounts).values([
      { userId: identity.sourceUserId, usedBytes: 12n },
      { userId: identity.targetUserId, usedBytes: 5n },
    ]);
    const [object] = await db
      .insert(schema.resourceStorageObjects)
      .values({
        ownerId: identity.sourceUserId,
        storageIdentity: 'test',
        objectKey,
        role: 'attachment',
        actualBytes: 12n,
        billable: true,
      })
      .returning();
    await db.insert(schema.userSettings).values([
      { userid: identity.sourceUserId, darkmode: true },
      { userid: identity.targetUserId, darkmode: false },
    ]);
    await db.insert(schema.aiConversations).values({
      ownerId: identity.sourceUserId,
      id: 'history',
      createdAt: new Date(),
      messages: [],
    });
    const [device] = await db
      .insert(schema.apnsDevices)
      .values({
        userid: identity.sourceUserId,
        installationId: randomUUID(),
        token: randomUUID(),
        environment: 'sandbox',
        timeZone: 'UTC',
      })
      .returning();
    await fixture.bindings.bindOAuthProvider(
      identity.sourceUserId,
      'apple',
      randomUUID(),
      'source-apple'
    );
    await fixture.callback(identity);
    const response = await fixture.requestMerge(identity);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data).toMatchObject({
      merged: true,
      mergedData: { notes: 1, attachments: 1, openKeys: 1, apnsDevices: 1, aiConversations: 1 },
    });
    const [movedNote] = await db
      .select()
      .from(schema.rotes)
      .where(operators.eq(schema.rotes.id, note.id));
    expect(movedNote).toMatchObject({
      authorid: identity.targetUserId,
      content: 'private content',
      state: 'private',
    });
    const [movedAttachment] = await db
      .select()
      .from(schema.attachments)
      .where(operators.eq(schema.attachments.id, attachment.id));
    expect(movedAttachment).toMatchObject({
      userid: identity.targetUserId,
      url: attachment.url,
      compressUrl: attachment.compressUrl,
      posterUrl: attachment.posterUrl,
      details: attachment.details,
    });
    const [movedKey] = await db
      .select()
      .from(schema.userOpenKeys)
      .where(operators.eq(schema.userOpenKeys.id, key.id));
    expect(movedKey.userid).toBe(identity.targetUserId);
    const [movedObject] = await db
      .select()
      .from(schema.resourceStorageObjects)
      .where(operators.eq(schema.resourceStorageObjects.id, object.id));
    expect(movedObject).toMatchObject({
      ownerId: identity.targetUserId,
      objectKey,
      actualBytes: 12n,
    });
    const [usage] = await db
      .select()
      .from(schema.resourceStorageAccounts)
      .where(operators.eq(schema.resourceStorageAccounts.userId, identity.targetUserId));
    expect(usage.usedBytes).toBe(17n);
    const [preferences] = await db
      .select()
      .from(schema.userSettings)
      .where(operators.eq(schema.userSettings.userid, identity.targetUserId));
    expect(preferences.darkmode).toBe(false);
    const [movedDevice] = await db
      .select()
      .from(schema.apnsDevices)
      .where(operators.eq(schema.apnsDevices.id, device.id));
    expect(movedDevice.userid).toBe(identity.targetUserId);
    const bindings = await fixture.bindings.getUserOAuthBindings(identity.targetUserId);
    expect(bindings).toHaveLength(2);
    expect(
      bindings.find((binding) => binding.provider === identity.provider).providerUsername
    ).toBe('verified-provider-name');
    expect(
      await db
        .select()
        .from(schema.users)
        .where(operators.eq(schema.users.id, identity.sourceUserId))
    ).toHaveLength(0);
    const receipt = await fixture.grant(identity);
    expect(receipt?.completedAt).not.toBeNull();
    expect(receipt?.result?.mergedData).toEqual(result.data.mergedData);
    expect(
      (
        await db
          .select()
          .from(schema.roteChanges)
          .where(operators.eq(schema.roteChanges.userid, identity.targetUserId))
      ).map((change) => change.revision)
    ).toEqual([1n]);
  });

  it('rolls grant consumption, binding transfer, note transfer and source deletion back together', async () => {
    const identity = await fixture.makePair();
    const { db, schema, operators } = fixture;
    const [note] = await db
      .insert(schema.rotes)
      .values({ authorid: identity.sourceUserId, content: 'must survive rollback' })
      .returning();
    await fixture.callback(identity);
    // An actual database failure at the last destructive step proves all prior
    // writes share the authorization transaction; no mocked repository is used.
    await db.execute(
      operators.sql.raw(
        `CREATE FUNCTION oauth_merge_test_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${identity.sourceUserId}'::uuid THEN RAISE EXCEPTION 'isolated merge rollback test'; END IF; RETURN OLD; END $$`
      )
    );
    await db.execute(
      operators.sql.raw(
        'CREATE TRIGGER oauth_merge_test_abort BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION oauth_merge_test_abort()'
      )
    );
    try {
      const response = await fixture.requestMerge(identity);
      expect(response.status).toBe(500);
      expect((await response.json()).errorCode).toBe('oauth_merge_failed');
      const [storedNote] = await db
        .select()
        .from(schema.rotes)
        .where(operators.eq(schema.rotes.id, note.id));
      expect(storedNote.authorid).toBe(identity.sourceUserId);
      expect((await fixture.grant(identity))?.completedAt).toBeNull();
      expect(await fixture.bindings.getUserOAuthBindings(identity.sourceUserId)).toHaveLength(1);
      expect(await fixture.bindings.getUserOAuthBindings(identity.targetUserId)).toHaveLength(0);
      expect(
        await db
          .select()
          .from(schema.roteChanges)
          .where(operators.eq(schema.roteChanges.userid, identity.targetUserId))
      ).toHaveLength(0);
    } finally {
      await db.execute(operators.sql.raw('DROP TRIGGER oauth_merge_test_abort ON users'));
      await db.execute(operators.sql.raw('DROP FUNCTION oauth_merge_test_abort()'));
    }
    expect((await fixture.requestMerge(identity)).status).toBe(200);
  });

  it('preserves billing restrictions for either account without consuming authorization', async () => {
    for (const side of ['sourceUserId', 'targetUserId'] as const) {
      const identity = await fixture.makePair();
      await fixture.callback(identity);
      await fixture.db.insert(fixture.schema.billingGrants).values({
        userId: identity[side],
        issuer: 'test',
        instanceId: 'test',
        revision: 1n,
        status: 'active',
        snapshotHash: 'test',
      });
      const response = await fixture.requestMerge(identity);
      expect(response.status).toBe(409);
      expect((await response.json()).errorCode).toBe('oauth_merge_billing_blocked');
      expect((await fixture.grant(identity))?.completedAt).toBeNull();
      await fixture.db
        .delete(fixture.schema.billingGrants)
        .where(fixture.operators.eq(fixture.schema.billingGrants.userId, identity[side]));
      expect((await fixture.requestMerge(identity)).status).toBe(200);
    }
  });
});
