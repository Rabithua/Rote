import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';

process.env.POSTGRESQL_URL ||= 'postgres://rote:rote_password_123@localhost:5433/rote';

const { articles, reactions, rotes, userBlocks, users } = await import('../drizzle/schema');
const { default: db, closeDatabase } = await import('../utils/drizzle');
const {
  findArticleById,
  findPublicRote,
  findRandomPublicRote,
  findRoteById,
  findRotesByIds,
  findUserPublicRote,
  getNoteByArticleId,
  searchPublicRotes,
  searchUserPublicRotes,
} = await import('../utils/dbMethods');
const {
  assertUsersMayInteract,
  blockUser,
  getBlockedUsers,
  getUserBlockRelationship,
  getViewerAwarePublicUserProfile,
  hasUserBlocked,
  unblockUser,
} = await import('./service');

const ids = {
  viewer: '10000000-0000-4000-8000-000000000001',
  blocked: '10000000-0000-4000-8000-000000000002',
  visibleOne: '10000000-0000-4000-8000-000000000003',
  visibleTwo: '10000000-0000-4000-8000-000000000004',
  cascade: '10000000-0000-4000-8000-000000000005',
  blockedNote: '20000000-0000-4000-8000-000000000001',
  visibleNoteOne: '20000000-0000-4000-8000-000000000002',
  visibleNoteTwo: '20000000-0000-4000-8000-000000000003',
  viewerNote: '20000000-0000-4000-8000-000000000004',
  blockedArticle: '30000000-0000-4000-8000-000000000001',
  visibleArticle: '30000000-0000-4000-8000-000000000002',
};

const allUserIds = [ids.viewer, ids.blocked, ids.visibleOne, ids.visibleTwo, ids.cascade];
const visibilityFixtureTag = 'user-block-visibility-fixture';

describe.serial('server-authoritative user blocks', () => {
  beforeAll(async () => {
    await db.delete(users).where(inArray(users.id, allUserIds));

    await db.insert(users).values([
      {
        id: ids.viewer,
        email: 'block-viewer@example.test',
        username: 'block-viewer',
      },
      {
        id: ids.blocked,
        email: 'block-target@example.test',
        username: 'block-target',
        nickname: 'Blocked target',
        description: 'Target description',
        emailVerified: true,
      },
      {
        id: ids.visibleOne,
        email: 'block-visible-one@example.test',
        username: 'block-visible-one',
      },
      {
        id: ids.visibleTwo,
        email: 'block-visible-two@example.test',
        username: 'block-visible-two',
      },
    ]);

    await db.insert(articles).values([
      {
        id: ids.blockedArticle,
        authorId: ids.blocked,
        content: '# Blocked article',
      },
      {
        id: ids.visibleArticle,
        authorId: ids.visibleOne,
        content: '# Visible article',
      },
    ]);

    await db.insert(rotes).values([
      {
        id: ids.blockedNote,
        authorid: ids.blocked,
        content: 'shared visibility keyword blocked',
        state: 'public',
        tags: [visibilityFixtureTag],
        articleId: ids.blockedArticle,
        createdAt: new Date('2026-07-28T05:00:00Z'),
        updatedAt: new Date('2026-07-28T05:00:00Z'),
      },
      {
        id: ids.visibleNoteOne,
        authorid: ids.visibleOne,
        content: 'shared visibility keyword visible one',
        state: 'public',
        tags: [visibilityFixtureTag],
        articleId: ids.visibleArticle,
        createdAt: new Date('2026-07-28T04:00:00Z'),
        updatedAt: new Date('2026-07-28T04:00:00Z'),
      },
      {
        id: ids.visibleNoteTwo,
        authorid: ids.visibleTwo,
        content: 'shared visibility keyword visible two',
        state: 'public',
        tags: [visibilityFixtureTag],
        createdAt: new Date('2026-07-28T03:00:00Z'),
        updatedAt: new Date('2026-07-28T03:00:00Z'),
      },
      {
        id: ids.viewerNote,
        authorid: ids.viewer,
        content: 'viewer own public note',
        state: 'public',
        createdAt: new Date('2026-07-28T02:00:00Z'),
        updatedAt: new Date('2026-07-28T02:00:00Z'),
      },
    ]);

    await db.insert(reactions).values([
      {
        type: 'blocked-user',
        userid: ids.blocked,
        roteid: ids.visibleNoteOne,
      },
      {
        type: 'visible-user',
        userid: ids.visibleTwo,
        roteid: ids.visibleNoteOne,
      },
      {
        type: 'anonymous',
        visitorId: 'block-test-visitor',
        roteid: ids.visibleNoteOne,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(users).where(inArray(users.id, allUserIds));
    await closeDatabase();
  });

  it('rejects self-blocking at both the service and database boundaries', async () => {
    await expect(blockUser(ids.viewer, ids.viewer)).rejects.toThrow('cannot block yourself');
    await expect(
      db.insert(userBlocks).values({ blockerId: ids.viewer, blockedId: ids.viewer }).execute()
    ).rejects.toThrow();
  });

  it('rejects a missing target and keeps unblock idempotent for missing relationships', async () => {
    const missing = '10000000-0000-4000-8000-000000000099';
    await expect(blockUser(ids.viewer, missing)).rejects.toThrow('User not found');
    await expect(unblockUser(ids.viewer, missing)).resolves.toEqual({
      blocked: false,
      targetUserId: missing,
    });
  });

  it('blocks idempotently and lists complete public summaries in stable order', async () => {
    await expect(blockUser(ids.viewer, ids.blocked)).resolves.toEqual({
      blocked: true,
      targetUserId: ids.blocked,
    });
    await expect(blockUser(ids.viewer, ids.blocked)).resolves.toEqual({
      blocked: true,
      targetUserId: ids.blocked,
    });

    const list = await getBlockedUsers(ids.viewer);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: ids.blocked,
      username: 'block-target',
      nickname: 'Blocked target',
      description: 'Target description',
      certified: true,
    });
    expect(list[0].blockedAt).toBeInstanceOf(Date);
  });

  it('returns a blocked profile only to its blocker and hides the reverse direction', async () => {
    await expect(
      getViewerAwarePublicUserProfile('block-target', ids.viewer)
    ).resolves.toMatchObject({
      id: ids.blocked,
      viewerHasBlocked: true,
    });
    await expect(getViewerAwarePublicUserProfile('block-viewer', ids.blocked)).rejects.toThrow(
      'User not found'
    );
  });

  it('filters public list and search before pagination', async () => {
    const filter = { tags: { hasEvery: [visibilityFixtureTag] } };
    const page = await findPublicRote(0, 2, filter, ids.viewer);
    expect(page.map((note: any) => note.id)).toEqual([ids.visibleNoteOne, ids.visibleNoteTwo]);

    const search = await searchPublicRotes('visibility keyword', 0, 2, filter, ids.viewer);
    expect(search.map((note: any) => note.id)).toEqual([ids.visibleNoteOne, ids.visibleNoteTwo]);
  });

  it('hides blocked authors from user lists, detail, batch, and random queries', async () => {
    await expect(findRoteById(ids.blockedNote, ids.viewer)).resolves.toBeNull();
    await expect(
      findRotesByIds([ids.blockedNote, ids.visibleNoteOne], ids.viewer)
    ).resolves.toMatchObject([{ id: ids.visibleNoteOne }]);
    await expect(findUserPublicRote(ids.blocked, 0, 20, {}, false, ids.viewer)).resolves.toEqual(
      []
    );
    await expect(
      searchUserPublicRotes(ids.blocked, 'keyword', 0, 20, {}, false, ids.viewer)
    ).resolves.toEqual([]);

    for (let attempt = 0; attempt < 12; attempt++) {
      const random = await findRandomPublicRote(ids.viewer);
      expect(random.authorid).not.toBe(ids.blocked);
    }
  });

  it('hides named reactions from blocked accounts while preserving anonymous reactions', async () => {
    const note = await findRoteById(ids.visibleNoteOne, ids.viewer);
    expect(note.reactions.map((reaction: any) => reaction.type).sort()).toEqual([
      'anonymous',
      'visible-user',
    ]);
  });

  it('hides blocked article and note detail in article context', async () => {
    await expect(findArticleById(ids.blockedArticle, ids.viewer)).resolves.toBeNull();
    await expect(getNoteByArticleId(ids.blockedArticle, ids.viewer)).resolves.toBeNull();
    await expect(findArticleById(ids.visibleArticle, ids.viewer)).resolves.toMatchObject({
      id: ids.visibleArticle,
    });
  });

  it('enforces interaction rejection and both relationship directions', async () => {
    await expect(assertUsersMayInteract(ids.viewer, ids.blocked)).rejects.toThrow('Rote not found');

    expect(await getUserBlockRelationship(ids.viewer, ids.blocked)).toEqual({
      viewerHasBlocked: true,
      targetHasBlocked: false,
    });

    await blockUser(ids.visibleTwo, ids.viewer);
    expect(await getUserBlockRelationship(ids.viewer, ids.visibleTwo)).toEqual({
      viewerHasBlocked: false,
      targetHasBlocked: true,
    });
    await expect(findRoteById(ids.visibleNoteTwo, ids.viewer)).resolves.toBeNull();
    await expect(assertUsersMayInteract(ids.viewer, ids.visibleTwo)).rejects.toThrow(
      'Rote not found'
    );
    await unblockUser(ids.visibleTwo, ids.viewer);
  });

  it('unblocks idempotently and immediately restores visibility', async () => {
    await expect(unblockUser(ids.viewer, ids.blocked)).resolves.toEqual({
      blocked: false,
      targetUserId: ids.blocked,
    });
    await expect(unblockUser(ids.viewer, ids.blocked)).resolves.toEqual({
      blocked: false,
      targetUserId: ids.blocked,
    });
    expect(await hasUserBlocked(ids.viewer, ids.blocked)).toBe(false);
    await expect(findRoteById(ids.blockedNote, ids.viewer)).resolves.toMatchObject({
      id: ids.blockedNote,
    });
  });

  it('cascades block relationships when either user is deleted', async () => {
    await db.insert(users).values({
      id: ids.cascade,
      email: 'block-cascade@example.test',
      username: 'block-cascade',
    });
    await blockUser(ids.viewer, ids.cascade);
    expect(await hasUserBlocked(ids.viewer, ids.cascade)).toBe(true);

    await db.delete(users).where(eq(users.id, ids.cascade));
    expect(await hasUserBlocked(ids.viewer, ids.cascade)).toBe(false);
    const dangling = await db
      .select()
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, ids.viewer), eq(userBlocks.blockedId, ids.cascade)));
    expect(dangling).toEqual([]);
  });
});
