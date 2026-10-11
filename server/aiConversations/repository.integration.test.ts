import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import fixture from './fixtures/rich-history.json';
import type { AiConversation, AiConversationWrite } from './types';
import { parseAiConversationWrite } from './validation';

const databaseUrl = process.env.AI_CONVERSATIONS_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('durable AI conversation repository', () => {
  const ownerId = randomUUID();
  const otherOwnerId = randomUUID();
  const pageOwnerId = randomUUID();
  const mergeSourceId = randomUUID();
  const mergeTargetId = randomUUID();
  const cascadeOwnerId = randomUUID();
  const userIds = [
    ownerId,
    otherOwnerId,
    pageOwnerId,
    mergeSourceId,
    mergeTargetId,
    cascadeOwnerId,
  ];
  let repository: typeof import('./repository');
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let operators: typeof import('drizzle-orm');

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    [repository, schema, operators, { default: database }] = await Promise.all([
      import('./repository'),
      import('../drizzle/schema'),
      import('drizzle-orm'),
      import('../utils/drizzle'),
    ]);
    await database.insert(schema.users).values(
      userIds.map((id) => ({
        id,
        email: `ai-conversations-${id}@example.test`,
        username: `ai-conversations-${id}`,
      }))
    );
  });

  afterAll(async () => {
    await database.delete(schema.users).where(operators.inArray(schema.users.id, userIds));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  function write(content?: string, baseRevision: number | null = null): AiConversationWrite {
    const snapshot = parseAiConversationWrite({
      baseRevision,
      createdAt: fixture.createdAt,
      agentConversationId: fixture.agentConversationId,
      messages:
        content === undefined
          ? structuredClone(fixture.messages)
          : [{ id: 'question', role: 'user', content, createdAt: fixture.createdAt }],
    });
    if (!snapshot) throw new Error('Invalid test fixture');
    return snapshot;
  }

  async function save(owner: string, id: string, snapshot = write()): Promise<AiConversation> {
    const result = await repository.putAiConversation(owner, id, snapshot);
    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') throw new Error('Expected accepted snapshot');
    return result.conversation;
  }

  it('roundtrips the canonical rich fixture without losing message metadata', async () => {
    const snapshot = write();
    const created = await save(ownerId, fixture.id, snapshot);
    expect(created).toMatchObject({
      id: fixture.id,
      revision: 1,
      createdAt: fixture.createdAt,
      deletedAt: null,
      agentConversationId: fixture.agentConversationId,
      messages: snapshot.messages,
    });
    expect(await repository.findAiConversation(ownerId, fixture.id)).toEqual(created);
    expect(created.messages[1].outputs?.[2].text).toBeUndefined();
    expect(created.messages[1].content).toBe(fixture.messages[1].content);
    expect(created.messages[3].errorDetail).toBe('response_interrupted');
  });

  it('isolates owner identity even when two accounts choose the same opaque ID', async () => {
    expect(await repository.findAiConversation(otherOwnerId, fixture.id)).toBeNull();
    expect(await repository.deleteAiConversation(otherOwnerId, fixture.id, 1)).toEqual({
      kind: 'not_found',
    });
    expect(
      await repository.putAiConversation(otherOwnerId, fixture.id, write('foreign', 1))
    ).toEqual({
      kind: 'not_found',
    });
    const other = await save(otherOwnerId, fixture.id, write('other account'));
    expect(other.messages[0].content).toBe('other account');
    expect((await repository.findAiConversation(ownerId, fixture.id))?.messages).toEqual(
      write().messages
    );
    const page = await repository.listAiConversations(otherOwnerId);
    expect(page.conversations.map((value) => value.id)).toEqual([fixture.id]);
  });

  it('requires create-only imports and replays exact saved snapshots without new activity', async () => {
    const created = await save(ownerId, 'revision', write('original'));
    const duplicateImport = await repository.putAiConversation(
      ownerId,
      'revision',
      write('original')
    );
    expect(duplicateImport).toEqual({ kind: 'conflict', conversation: created });

    const changed = await save(ownerId, 'revision', write('updated', created.revision));
    expect(changed.revision).toBe(2);
    const replay = await repository.putAiConversation(ownerId, 'revision', write('updated', 1));
    expect(replay).toEqual({ kind: 'saved', conversation: changed });
    expect(await repository.putAiConversation(ownerId, 'revision', write('updated', 3))).toEqual({
      kind: 'conflict',
      conversation: changed,
    });
    expect(await repository.putAiConversation(ownerId, 'revision', write('outdated', 1))).toEqual({
      kind: 'conflict',
      conversation: changed,
    });
    expect(
      await repository.putAiConversation(ownerId, 'revision', {
        ...write('updated', 2),
        createdAt: '2026-10-10T04:00:00.000Z',
      })
    ).toEqual({ kind: 'conflict', conversation: changed });
    expect(await repository.findAiConversation(ownerId, 'revision')).toEqual(changed);
  });

  it('serializes concurrent first saves before a row exists', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        repository.putAiConversation(ownerId, 'concurrent-create', write(`branch-${index}`))
      )
    );
    const accepted = results.filter((result) => result.kind === 'saved');
    expect(accepted).toHaveLength(1);
    const winner = accepted[0];
    if (winner.kind !== 'saved') throw new Error('Expected one accepted create');
    expect(results.filter((result) => result.kind === 'conflict')).toHaveLength(5);
    for (const result of results) {
      if (result.kind !== 'not_found') expect(result.conversation).toEqual(winner.conversation);
    }
  });

  it('accepts only one divergent write from a concurrent matching revision', async () => {
    await save(ownerId, 'concurrent-update', write('start'));
    const results = await Promise.all([
      repository.putAiConversation(ownerId, 'concurrent-update', write('first', 1)),
      repository.putAiConversation(ownerId, 'concurrent-update', write('second', 1)),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual(['conflict', 'saved']);
    const current = await repository.findAiConversation(ownerId, 'concurrent-update');
    expect(current?.revision).toBe(2);
    for (const result of results) {
      if (result.kind !== 'not_found') expect(result.conversation).toEqual(current);
    }
  });

  it('keeps a permanent empty tombstone after deletion and rejects stale creates and updates', async () => {
    const original = await save(ownerId, 'deleted', write());
    expect(await repository.deleteAiConversation(ownerId, 'deleted', 42)).toEqual({
      kind: 'conflict',
      conversation: original,
    });
    const deleted = await repository.deleteAiConversation(ownerId, 'deleted', original.revision);
    if (deleted.kind !== 'saved') throw new Error('Expected deletion');
    expect(deleted.conversation).toMatchObject({ revision: 2, messages: [] });
    expect(deleted.conversation.deletedAt).toBeString();
    expect(deleted.conversation).not.toHaveProperty('agentConversationId');
    for (const revision of [null, 1, 2]) {
      expect(
        await repository.putAiConversation(ownerId, 'deleted', write('late', revision))
      ).toEqual({
        kind: 'conflict',
        conversation: deleted.conversation,
      });
    }
    expect(await repository.deleteAiConversation(ownerId, 'deleted', 1)).toEqual(deleted);
    expect(await repository.findAiConversation(ownerId, 'deleted')).toEqual(deleted.conversation);
    expect(
      (await repository.listAiConversations(ownerId)).conversations.find(
        (row) => row.id === 'deleted'
      )
    ).toEqual(deleted.conversation);
  });

  it('allows a serialized in-flight create to be followed by deletion', async () => {
    const create = repository.putAiConversation(ownerId, 'pending-create', write('pending'));
    const deletion = create.then((result) => {
      if (result.kind !== 'saved') throw new Error('Expected in-flight create');
      return repository.deleteAiConversation(
        ownerId,
        'pending-create',
        result.conversation.revision
      );
    });
    const deleted = await deletion;
    expect(deleted.kind).toBe('saved');
    const current = await repository.findAiConversation(ownerId, 'pending-create');
    expect(current?.messages).toEqual([]);
    expect(current?.deletedAt).toBeString();
    expect(
      (await repository.putAiConversation(ownerId, 'pending-create', write('late', 1))).kind
    ).toBe('conflict');
  });

  it('paginates equal activity timestamps using opaque ID ties and includes tombstones', async () => {
    const activity = new Date('2026-10-11T06:00:00.123Z');
    await database.insert(schema.aiConversations).values(
      Array.from({ length: 55 }, (_, index) => ({
        ownerId: pageOwnerId,
        id: `page-${index.toString().padStart(3, '0')}`,
        createdAt: new Date(fixture.createdAt),
        updatedAt: activity,
        messages: [],
        deletedAt: index === 7 ? activity : null,
      }))
    );
    const first = await repository.listAiConversations(pageOwnerId, { limit: 100 });
    expect(first.conversations).toHaveLength(50);
    const fetched: AiConversation[] = [];
    let cursor: string | null = null;
    do {
      const page = await repository.listAiConversations(pageOwnerId, { limit: 7, cursor });
      fetched.push(...page.conversations);
      cursor = page.nextCursor;
    } while (cursor);
    expect(fetched).toHaveLength(55);
    expect(new Set(fetched.map((row) => row.id)).size).toBe(55);
    expect(fetched.map((row) => row.id)).toEqual(
      Array.from({ length: 55 }, (_, index) => `page-${(54 - index).toString().padStart(3, '0')}`)
    );
    expect(fetched.filter((row) => row.deletedAt)).toHaveLength(1);
    const selected = await repository.findAiConversation(pageOwnerId, 'page-007');
    expect(selected?.updatedAt).toBe(activity.toISOString());
    expect(selected?.revision).toBe(1);
  });

  it('rejects malformed cursors rather than silently restarting a history list', async () => {
    for (const cursor of [
      '',
      '?',
      Buffer.from('null').toString('base64url'),
      Buffer.from(JSON.stringify({ updatedAt: 'not-a-date', id: 'page-001' })).toString(
        'base64url'
      ),
      Buffer.from(JSON.stringify({ updatedAt: fixture.updatedAt, id: '' })).toString('base64url'),
    ]) {
      await expect(repository.listAiConversations(ownerId, { cursor })).rejects.toBeInstanceOf(
        repository.InvalidAiConversationCursor
      );
    }
  });

  it('cascades account deletion and does not attach a late write to a missing account', async () => {
    await save(cascadeOwnerId, 'cascade', write('account removed'));
    await database.delete(schema.users).where(operators.eq(schema.users.id, cascadeOwnerId));
    expect(await repository.findAiConversation(cascadeOwnerId, 'cascade')).toBeNull();
    expect(await repository.putAiConversation(cascadeOwnerId, 'late', write())).toEqual({
      kind: 'not_found',
    });
  });

  it('merges account histories while preserving collisions and both active and deleted snapshots', async () => {
    await save(mergeSourceId, 'source-only', write('source unique'));
    const sourceActive = await save(mergeSourceId, 'shared-active', write('source active'));
    await save(mergeTargetId, 'shared-active', write('target deleted'));
    await repository.deleteAiConversation(mergeTargetId, 'shared-active', 1);
    await save(mergeSourceId, 'shared-tombstone', write('source deleted'));
    const sourceTombstone = await repository.deleteAiConversation(
      mergeSourceId,
      'shared-tombstone',
      1
    );
    const targetActive = await save(mergeTargetId, 'shared-tombstone', write('target active'));

    const { mergeUserAccounts } = await import('../utils/dbMethods/userAccount');
    const result = await mergeUserAccounts(mergeSourceId, mergeTargetId);
    expect(result.mergedData.aiConversations).toBe(3);
    const page = await repository.listAiConversations(mergeTargetId);
    expect(page.conversations).toHaveLength(5);
    expect(page.conversations.filter((row) => row.deletedAt)).toHaveLength(2);
    expect(await repository.findAiConversation(mergeTargetId, 'shared-tombstone')).toEqual(
      targetActive
    );
    const unchangedTombstone = await repository.findAiConversation(mergeTargetId, 'shared-active');
    expect(unchangedTombstone?.deletedAt).toBeString();
    expect(unchangedTombstone?.messages).toEqual([]);
    const migratedActive = page.conversations.find(
      (row) => row.messages[0]?.content === 'source active'
    );
    expect(migratedActive?.id).not.toBe('shared-active');
    expect(migratedActive).toMatchObject({
      messages: sourceActive.messages,
      createdAt: sourceActive.createdAt,
      updatedAt: sourceActive.updatedAt,
      revision: sourceActive.revision,
    });
    if (sourceTombstone.kind !== 'saved') throw new Error('Expected source tombstone');
    expect(
      page.conversations.find(
        (row) => row.deletedAt && row.id !== 'shared-active' && row.id !== 'source-only'
      )
    ).toMatchObject({
      messages: [],
      deletedAt: sourceTombstone.conversation.deletedAt,
      revision: sourceTombstone.conversation.revision,
    });
    expect((await repository.listAiConversations(mergeSourceId)).conversations).toEqual([]);
  });
});
