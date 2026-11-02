import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  createOAuthMergeFixture,
  oauthMergeDatabaseUrl,
  type OAuthMergeFixture,
} from './integrationFixture';

const databaseDescribe = oauthMergeDatabaseUrl ? describe : describe.skip;

databaseDescribe('OAuth merge concurrency and retry receipts', () => {
  let fixture: OAuthMergeFixture;
  beforeAll(async () => {
    fixture = await createOAuthMergeFixture();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  it('serializes duplicate confirmations and replays the original success after source deletion', async () => {
    const identity = await fixture.makePair();
    await fixture.db
      .insert(fixture.schema.rotes)
      .values({ authorid: identity.sourceUserId, content: 'only once' });
    await fixture.callback(identity);
    const responses = await Promise.all([
      fixture.requestMerge(identity),
      fixture.requestMerge(identity),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const results = await Promise.all(responses.map((response) => response.json()));
    expect(results[0]).toEqual(results[1]);
    expect((await (await fixture.requestMerge(identity)).json()).data).toEqual(results[0].data);
    const changes = await fixture.db
      .select()
      .from(fixture.schema.roteChanges)
      .where(fixture.operators.eq(fixture.schema.roteChanges.userid, identity.targetUserId));
    expect(changes).toHaveLength(1);
    await fixture.config.setConfig('security', {
      ...fixture.security,
      oauth: { ...fixture.security.oauth, enabled: false },
    });
    try {
      expect((await fixture.requestMerge(identity)).status).toBe(200);
    } finally {
      await fixture.config.setConfig('security', fixture.security);
    }
    await fixture.db
      .update(fixture.schema.oauthMergeAuthorizations)
      .set({ completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(
        fixture.operators.eq(
          fixture.schema.oauthMergeAuthorizations.targetUserId,
          identity.targetUserId
        )
      );
    expect((await fixture.requestMerge(identity)).status).toBe(403);
  });

  it('allows one destination to win when two verified users concurrently merge the same source', async () => {
    const first = await fixture.makePair();
    const second = { ...first, targetUserId: await fixture.makeUser() };
    const [note] = await fixture.db
      .insert(fixture.schema.rotes)
      .values({ authorid: first.sourceUserId, content: 'single destination' })
      .returning();
    await fixture.callback(first);
    await fixture.callback(second);
    const responses = await Promise.all([
      fixture.requestMerge(first),
      fixture.requestMerge(second),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? first : second;
    const [stored] = await fixture.db
      .select()
      .from(fixture.schema.rotes)
      .where(fixture.operators.eq(fixture.schema.rotes.id, note.id));
    expect(stored.authorid).toBe(winner.targetUserId);
    expect((await fixture.grant(winner))?.completedAt).not.toBeNull();
  });

  it('rechecks the target provider after two different source accounts race for the same destination', async () => {
    const first = await fixture.makePair();
    const second = { ...(await fixture.makePair()), targetUserId: first.targetUserId };
    await fixture.callback(first);
    await fixture.callback(second);
    const responses = await Promise.all([
      fixture.requestMerge(first),
      fixture.requestMerge(second),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const loser = responses[0].status === 200 ? second : first;
    expect(await fixture.bindings.getUserOAuthBindings(loser.sourceUserId)).toHaveLength(1);
    expect((await fixture.grant(loser))?.completedAt).toBeNull();
  });

  async function holdUser(userId: string) {
    let locked!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transaction = fixture.db.transaction(async (tx) => {
      await tx
        .select()
        .from(fixture.schema.users)
        .where(fixture.operators.eq(fixture.schema.users.id, userId))
        .for('update');
      locked();
      await held;
    });
    await ready;
    return { release, transaction };
  }

  it('serializes a new target binding with the merge without deadlock or mixed ownership', async () => {
    const identity = await fixture.makePair();
    await fixture.callback(identity);
    const held = await holdUser(identity.targetUserId);
    const confirmation = fixture.requestMerge(identity);
    const competingId = randomUUID();
    const binding = fixture.bindings.bindOAuthProvider(
      identity.targetUserId,
      identity.provider,
      competingId
    );
    held.release();
    const [merge, bound] = await Promise.all([
      confirmation,
      binding.then(
        () => true,
        () => false
      ),
      held.transaction,
    ]);
    const stored = await fixture.bindings.getUserOAuthBindings(identity.targetUserId);
    expect(stored).toHaveLength(1);
    if (merge.status === 200) {
      expect(bound).toBe(false);
      expect(stored[0].providerId).toBe(identity.providerId);
    } else {
      expect([403, 409]).toContain(merge.status);
      expect(bound).toBe(true);
      expect(stored[0].providerId).toBe(competingId);
      expect(await fixture.bindings.getUserOAuthBindings(identity.sourceUserId)).toHaveLength(1);
    }
  });

  it('invalidates pending authority when the source unbinds and rebinds the same subject', async () => {
    const identity = await fixture.makePair();
    await fixture.bindings.bindOAuthProvider(identity.sourceUserId, 'apple', randomUUID());
    await fixture.callback(identity);
    const bindingId = (await fixture.grant(identity))!.sourceBindingId;
    await fixture.bindings.unbindOAuthProvider(identity.sourceUserId, identity.provider);
    expect(await fixture.grant(identity)).toBeNull();
    const rebound = await fixture.bindings.bindOAuthProvider(
      identity.sourceUserId,
      identity.provider,
      identity.providerId
    );
    expect(rebound.id).not.toBe(bindingId);
    expect((await fixture.requestMerge(identity)).status).toBe(403);
    await fixture.callback(identity);
    expect((await fixture.requestMerge(identity)).status).toBe(200);
  });

  it('keeps a login provider when a passwordless user concurrently unbinds both providers', async () => {
    const userId = await fixture.makeUser();
    await fixture.bindings.bindOAuthProvider(userId, 'github', randomUUID());
    await fixture.bindings.bindOAuthProvider(userId, 'apple', randomUUID());
    const authorization = await fixture.token(userId);
    const requests = await Promise.all(
      ['github', 'apple'].map((provider) =>
        fixture.app.request(`/auth/oauth/${provider}/bind`, {
          method: 'DELETE',
          headers: { authorization },
        })
      )
    );
    expect(requests.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(await fixture.bindings.getUserOAuthBindings(userId)).toHaveLength(1);
  });
});
