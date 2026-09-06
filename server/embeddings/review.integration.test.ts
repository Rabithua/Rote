import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_AI_CONFIG } from '../utils/ai/providers';

if (
  !process.env.POSTGRESQL_URL ||
  !new URL(process.env.POSTGRESQL_URL).pathname.endsWith('_embedding_test')
)
  throw new Error('Embedding regressions require a dedicated *_embedding_test database');

const { default: db, closeDatabase } = await import('../utils/drizzle');
const {
  users,
  rotes,
  articles,
  settings,
  documentEmbeddings,
  embeddingJobs,
  embeddingIndexState,
  embeddingSourceEvents,
} = await import('../drizzle/schema');
const { saveAiSettings, readAiSnapshot } = await import('./configStore');
const { startIndexRebuild, clearAllEmbeddings, retryFailedEmbeddingJobs } =
  await import('./indexLifecycle');
const { ensurePgvectorReady, getPgvectorStatus } = await import('../utils/dbMethods/ai/vector');
const { processPendingEmbeddingJobs } = await import('../utils/dbMethods/ai/embeddingWorker');
const { consumeSourceEvents } = await import('./sourceEvents');
const { claimEmbeddingJob } = await import('./jobClaims');
const { processEmbeddingJob } = await import('./jobProcessor');
const ownerId = '13510000-0000-4000-8000-000000000001';
const noteId = '13510000-0000-4000-8000-000000000002';
const articleId = '13510000-0000-4000-8000-000000000003';
const realFetch = globalThis.fetch;
let requests: unknown[] = [];

function provider() {
  globalThis.fetch = (async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
  }) as typeof fetch;
}
async function readyIndex() {
  const config = await saveAiSettings({
    ...structuredClone(DEFAULT_AI_CONFIG),
    enabled: true,
    vectorEnabled: true,
    autoIndexEnabled: true,
    embedding: {
      ...DEFAULT_AI_CONFIG.embedding,
      baseUrl: 'https://embedding.test/v1',
      model: 'fixture',
    },
  });
  await db.insert(rotes).values({ id: noteId, authorid: ownerId, content: 'original note' });
  await db
    .insert(articles)
    .values({ id: articleId, authorId: ownerId, content: 'original article' });
  await ensurePgvectorReady();
  await startIndexRebuild(config.revision);
  await completeRebuild();
  return config;
}
async function completeRebuild() {
  for (let i = 0; i < 10 && (await readAiSnapshot()).state.status !== 'ready'; i++)
    await processPendingEmbeddingJobs(20);
  expect((await getPgvectorStatus()).ready).toBe(true);
}
async function indexNames() {
  return (
    await db.execute(sql`SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='document_embeddings'
      AND indexname ~ '^embedding_[0-9a-f]{32}_[0-9]+_idx$'`)
  )
    .map((row) => String(row.indexname))
    .sort();
}
beforeEach(async () => {
  provider();
  requests = [];
  await clearAllEmbeddings();
  await db.delete(rotes);
  await db.delete(articles);
  await db.delete(embeddingSourceEvents);
  await db.delete(settings).where(eq(settings.group, 'ai'));
  await db
    .update(embeddingIndexState)
    .set({
      revision: 0,
      fingerprint: null,
      dimensions: null,
      generationId: null,
      status: 'needs_validation',
      errorCode: null,
    })
    .where(eq(embeddingIndexState.id, 1));
  await db
    .insert(users)
    .values({
      id: ownerId,
      email: 'review@example.test',
      username: 'review-fixture',
      role: 'admin',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  await clearAllEmbeddings();
  await db.delete(rotes);
  await db.delete(articles);
  await db.delete(embeddingSourceEvents);
  await closeDatabase();
});

describe.serial('embedding review regressions', () => {
  it('ignores metadata and no-op updates but indexes changed text and ownership', async () => {
    await readyIndex();
    requests = [];
    await db
      .update(rotes)
      .set({ updatedAt: new Date(), state: 'public', archived: true, content: 'original note' })
      .where(eq(rotes.id, noteId));
    await db
      .update(articles)
      .set({ updatedAt: new Date(), content: 'original article' })
      .where(eq(articles.id, articleId));
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(0);
    await processPendingEmbeddingJobs(20);
    expect(requests).toHaveLength(0);

    await db
      .update(rotes)
      .set({ title: 'New title', tags: ['changed'] })
      .where(eq(rotes.id, noteId));
    await db.update(articles).set({ content: 'changed article' }).where(eq(articles.id, articleId));
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(2);
    await processPendingEmbeddingJobs(20);
    expect(requests).toHaveLength(2);
    const vectors = await db.select().from(documentEmbeddings);
    expect(vectors.find((row) => row.sourceId === noteId)?.text).toContain('Tags: changed');
    expect(vectors.find((row) => row.sourceId === articleId)?.text).toBe('changed article');

    const nextOwner = '13510000-0000-4000-8000-000000000004';
    await db
      .insert(users)
      .values({
        id: nextOwner,
        email: 'new-owner@example.test',
        username: 'new-owner',
        role: 'admin',
      })
      .onConflictDoNothing();
    await db.update(rotes).set({ authorid: nextOwner }).where(eq(rotes.id, noteId));
    await db.update(articles).set({ authorId: nextOwner }).where(eq(articles.id, articleId));
    await processPendingEmbeddingJobs(20);
    expect(
      (await db.select().from(documentEmbeddings)).every((row) => row.ownerId === nextOwner)
    ).toBe(true);
  });

  it('processes deletes behind a full deferred page and catches up after returning to the retained model', async () => {
    const original = await readyIndex();
    const changed = await saveAiSettings({
      ...original,
      autoIndexEnabled: false,
      embedding: { ...original.embedding, model: 'another-model' },
    });
    for (let i = 0; i < 105; i++)
      await db
        .update(rotes)
        .set({ content: `deferred edit ${i}` })
        .where(eq(rotes.id, noteId));
    await db.delete(articles).where(eq(articles.id, articleId));
    const count = requests.length;
    await consumeSourceEvents();
    expect(
      await db.select().from(documentEmbeddings).where(eq(documentEmbeddings.sourceId, articleId))
    ).toHaveLength(0);
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(105);
    expect(requests).toHaveLength(count);
    await saveAiSettings({ ...original, revision: changed.revision, autoIndexEnabled: false });
    await completeRebuild();
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(0);
    expect((await db.select().from(documentEmbeddings))[0].text).toBe('deferred edit 104');
  });

  it('does not invalidate an in-flight embedding when only source metadata changes', async () => {
    await readyIndex();
    await db.update(rotes).set({ content: 'new text' }).where(eq(rotes.id, noteId));
    await consumeSourceEvents();
    const claim = (await claimEmbeddingJob())!;
    globalThis.fetch = (async () => {
      await db
        .update(rotes)
        .set({ updatedAt: new Date(), archived: true })
        .where(eq(rotes.id, noteId));
      return Response.json({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    }) as typeof fetch;
    await processEmbeddingJob(claim.job, claim.config, 3);
    expect(
      (await db.select().from(embeddingJobs).where(eq(embeddingJobs.id, claim.job.id)))[0].status
    ).toBe('succeeded');
    expect(await claimEmbeddingJob()).toBeNull();
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(0);
    expect(
      (await db.select().from(documentEmbeddings).where(eq(documentEmbeddings.sourceId, noteId)))[0]
        .text
    ).toBe('new text');
  });

  it('replaces an expired predecessor with its pending successor without duplicate model calls', async () => {
    await readyIndex();
    await db.update(rotes).set({ content: 'first revision' }).where(eq(rotes.id, noteId));
    await consumeSourceEvents();
    const predecessor = (await claimEmbeddingJob())!;
    await db.update(rotes).set({ content: 'latest revision' }).where(eq(rotes.id, noteId));
    await consumeSourceEvents();
    expect(await claimEmbeddingJob()).toBeNull(); // Its live lease still fences the successor.
    await db
      .update(embeddingJobs)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(embeddingJobs.id, predecessor.job.id));
    const successor = (await claimEmbeddingJob())!;
    expect(successor.job.id).not.toBe(predecessor.job.id);
    expect(
      (await db.select().from(embeddingJobs).where(eq(embeddingJobs.id, predecessor.job.id)))[0]
    ).toMatchObject({ status: 'cancelled', leaseToken: null });
    const count = requests.length;
    await expect(processEmbeddingJob(predecessor.job, predecessor.config, 3)).rejects.toMatchObject(
      { code: 'embedding_lease_lost' }
    );
    await processEmbeddingJob(successor.job, successor.config, 3);
    await processPendingEmbeddingJobs(20);
    expect(requests).toHaveLength(count + 1);
    expect(
      (await db.select().from(documentEmbeddings).where(eq(documentEmbeddings.sourceId, noteId)))[0]
        .text
    ).toBe('latest revision');
    expect(await claimEmbeddingJob()).toBeNull();
  });

  it('retains old generations on failure and retires them only after a replacement is ready', async () => {
    const config = await readyIndex();
    const previous = (await readAiSnapshot()).state.generationId!;
    const oldIndexes = await indexNames();
    const [oldVector] = await db.select().from(documentEmbeddings);
    await db
      .insert(documentEmbeddings)
      .values({ ...oldVector, id: crypto.randomUUID(), generationId: null });
    await startIndexRebuild(config.revision);
    expect(await indexNames()).toHaveLength(2);
    globalThis.fetch = (async () => Response.json({}, { status: 400 })) as typeof fetch;
    await processPendingEmbeddingJobs(20);
    expect((await readAiSnapshot()).state.status).toBe('failed');
    expect(
      await db
        .select()
        .from(documentEmbeddings)
        .where(eq(documentEmbeddings.generationId, previous))
    ).toHaveLength(2);
    expect(await indexNames()).toContain(oldIndexes[0]);

    provider();
    await retryFailedEmbeddingJobs();
    await completeRebuild();
    expect(
      await db
        .select()
        .from(documentEmbeddings)
        .where(eq(documentEmbeddings.generationId, previous))
    ).toHaveLength(0);
    expect(
      await db.select().from(embeddingJobs).where(eq(embeddingJobs.generationId, previous))
    ).toHaveLength(0);
    expect(await indexNames()).toHaveLength(1);
    expect(await indexNames()).not.toContain(oldIndexes[0]);
    expect(
      (await db.select().from(documentEmbeddings)).filter((row) => row.generationId === null)
    ).toHaveLength(1);
    await startIndexRebuild(config.revision);
    await completeRebuild();
    expect(await indexNames()).toHaveLength(1);
    expect(await db.select().from(documentEmbeddings)).toHaveLength(3);
    await clearAllEmbeddings();
    expect(await indexNames()).toHaveLength(0);
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
  });
});
