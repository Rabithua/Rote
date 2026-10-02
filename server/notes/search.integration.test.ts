import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.NOTE_SEARCH_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('note keyword search', () => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const ids = {
    tag: randomUUID(),
    title: randomUUID(),
    content: randomUUID(),
    english: randomUUID(),
    quote: randomUUID(),
    emoji: randomUUID(),
    empty: randomUUID(),
    archived: randomUUID(),
    otherOwner: randomUUID(),
  };
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let search: typeof import('../utils/dbMethods/note');
  let operators: typeof import('drizzle-orm');

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    [schema, search, operators, { default: database }] = await Promise.all([
      import('../drizzle/schema'),
      import('../utils/dbMethods/note'),
      import('drizzle-orm'),
      import('../utils/drizzle'),
    ]);
    await database.insert(schema.users).values(
      [ownerId, otherUserId].map((id) => ({
        id,
        email: `search-${id}@example.test`,
        username: `search-${id}`,
      }))
    );
    const createdAt = new Date('2026-10-02T12:00:00Z');
    await database.insert(schema.rotes).values([
      { id: ids.tag, authorid: ownerId, content: 'tag only', tags: ['界面设计'], createdAt },
      {
        id: ids.title,
        authorid: ownerId,
        title: '设计方案',
        content: 'title only',
        tags: [],
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        id: ids.content,
        authorid: ownerId,
        content: '这是设计笔记',
        tags: [],
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      { id: ids.english, authorid: ownerId, content: 'english tag', tags: ['GitHub'] },
      { id: ids.quote, authorid: ownerId, content: 'quoted tag', tags: ["O'Reilly"] },
      { id: ids.emoji, authorid: ownerId, content: 'emoji tag', tags: ['🐱'] },
      { id: ids.empty, authorid: ownerId, content: 'unrelated', tags: [] },
      { id: ids.archived, authorid: ownerId, content: 'archived', tags: ['设计'], archived: true },
      { id: ids.otherOwner, authorid: otherUserId, content: 'other owner', tags: ['设计'] },
    ]);
  });

  afterAll(async () => {
    await database
      .delete(schema.users)
      .where(operators.inArray(schema.users.id, [ownerId, otherUserId]));
    const { closeDatabase } = await import('../utils/drizzle');
    await closeDatabase();
  });

  async function matchingIds(keyword: string, filter = {}) {
    const notes = await search.searchMyRotes(ownerId, keyword, 0, 20, filter);
    return notes.map((note: { id: string }) => note.id).sort();
  }

  it('matches partial tags, titles, and content in one query while keeping owner and archive scope', async () => {
    expect(await matchingIds('设计')).toEqual([ids.tag, ids.title, ids.content].sort());
  });

  it('matches English tags without case sensitivity', async () => {
    expect(await matchingIds('github')).toEqual([ids.english]);
    expect(await matchingIds('HUB')).toEqual([ids.english]);
  });

  it('supports quoted and emoji tag names', async () => {
    expect(await matchingIds("O'Rei")).toEqual([ids.quote]);
    expect(await matchingIds('🐱')).toEqual([ids.emoji]);
    expect(await matchingIds("' OR TRUE --")).toEqual([]);
  });

  it('combines tag text matching with the existing date filter', async () => {
    expect(await matchingIds('设计', { date: '2026-10-02' })).toEqual([ids.tag]);
    expect(await matchingIds('设计', { date: '2026-10-01' })).toEqual(
      [ids.title, ids.content].sort()
    );
  });

  it('keeps explicit tag filters exact for API consumers', async () => {
    expect(await matchingIds('设计', { tags: { hasEvery: ['界面设计'] } })).toEqual([ids.tag]);
    expect(await matchingIds('设计', { tags: { hasEvery: ['设计'] } })).toEqual([]);
  });
});
