import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_AI_CONFIG } from '../utils/ai/providers';

if (
  !process.env.POSTGRESQL_URL ||
  !new URL(process.env.POSTGRESQL_URL).pathname.endsWith('_embedding_test')
) {
  throw new Error('Embedding integration tests require a dedicated *_embedding_test database');
}
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
const { getPgvectorStatus, ensurePgvectorReady } = await import('../utils/dbMethods/ai/vector');
const { processPendingEmbeddingJobs } = await import('../utils/dbMethods/ai/embeddingWorker');
const { enqueueEmbeddingJob, getEmbeddingJobStats } = await import('./queue');
const { claimEmbeddingJob } = await import('./jobClaims');
const { processEmbeddingJob } = await import('./jobProcessor');
const { scanRebuildPage } = await import('./rebuildScanner');
const { semanticSearch } = await import('../utils/dbMethods/ai/semanticSearch');
const ownerId = '13180000-0000-4000-8000-000000000001';
const noteId = '13180000-0000-4000-8000-000000000002';
const articleId = '13180000-0000-4000-8000-000000000003';
const realFetch = globalThis.fetch;
let requests: Record<string, unknown>[] = [];
function provider(dimensions = 3) {
  globalThis.fetch = (async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ data: [{ embedding: Array(dimensions).fill(0.1) }] });
  }) as typeof fetch;
}
async function saveConfig() {
  return saveAiSettings({
    ...structuredClone(DEFAULT_AI_CONFIG),
    enabled: true,
    vectorEnabled: true,
    embedding: {
      ...DEFAULT_AI_CONFIG.embedding,
      baseUrl: 'https://embedding.test/v1',
      model: 'BAAI/bge-m3',
    },
  });
}
async function note(content = 'embedding fixture') {
  await db
    .insert(rotes)
    .values({ id: noteId, authorid: ownerId, content })
    .onConflictDoUpdate({ target: rotes.id, set: { content, updatedAt: new Date() } });
}
async function completeRebuild() {
  for (let i = 0; i < 10; i++) {
    if ((await readAiSnapshot()).state.status === 'ready') return;
    await processPendingEmbeddingJobs(20);
  }
  expect((await readAiSnapshot()).state.status).toBe('ready');
}
beforeEach(async () => {
  requests = [];
  provider();
  await clearAllEmbeddings();
  await db.delete(rotes).where(eq(rotes.id, noteId));
  await db.delete(articles).where(eq(articles.id, articleId));
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
      scanSource: 'rote',
      scanCursor: null,
      scanComplete: false,
      errorCode: null,
    })
    .where(eq(embeddingIndexState.id, 1));
  await db
    .insert(users)
    .values({
      id: ownerId,
      email: 'embedding@example.test',
      username: 'embedding-fixture',
      role: 'admin',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  await closeDatabase();
});

describe.serial('embedding configuration and index lifecycle', () => {
  it('verifies at save time, rejects forged dimensions and stale revisions, preserves working settings on failure', async () => {
    const saved = await saveConfig();
    expect((await readAiSnapshot()).state.status).toBe('needs_rebuild');
    expect(saved.revision).toBe(1);
    await expect(saveAiSettings({ ...saved, revision: 0 })).rejects.toMatchObject({
      code: 'embedding_revision_conflict',
    });
    await expect(
      saveAiSettings({ ...saved, embedding: { ...saved.embedding, dimensions: 18 } } as never)
    ).rejects.toMatchObject({ code: 'embedding_config_invalid' });
    provider(2001);
    await expect(
      saveAiSettings({ ...saved, embedding: { ...saved.embedding, model: 'different' } })
    ).rejects.toMatchObject({ code: 'embedding_dimensions_limit' });
    expect((await readAiSnapshot()).config).toEqual(saved);
  });
  it('builds a real HNSW index, serves generation-scoped results and preserves ready state on key rotation', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    const started = await startIndexRebuild(config.revision);
    expect(started.status).toBe('rebuilding');
    expect((await startIndexRebuild(config.revision)).generationId).toBe(started.generationId);
    await expect(
      semanticSearch({ query: 'test', ownerId, viewerId: ownerId })
    ).rejects.toMatchObject({ code: 'embedding_rebuild_required' });
    await completeRebuild();
    expect((await getPgvectorStatus()).ready).toBe(true);
    expect(
      (await semanticSearch({ query: 'fixture', ownerId, viewerId: ownerId })).map(
        (row) => row.sourceId
      )
    ).toContain(noteId);
    const saved = await saveAiSettings({
      ...config,
      embedding: { ...config.embedding, apiKey: 'rotated-placeholder' },
    });
    expect((await readAiSnapshot()).state).toMatchObject({
      status: 'ready',
      generationId: started.generationId,
    });
    await saveAiSettings({
      ...saved,
      embedding: { ...saved.embedding, baseUrl: 'https://other.test/v1' },
    });
    expect((await readAiSnapshot()).state.status).toBe('needs_rebuild');
    expect(await db.select().from(documentEmbeddings)).toHaveLength(1);
  });
  it('indexes and retrieves the full 2000-dimensional storage boundary', async () => {
    provider(2000);
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    expect((await getPgvectorStatus()).dimensions).toBe(2000);
    expect(await semanticSearch({ query: 'fixture', ownerId, viewerId: ownerId })).toHaveLength(1);
  });
  it('rolls back replacement when the database rejects a generated source', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    const previous = await db.select().from(documentEmbeddings);
    await note('changed source with rejected database insert');
    await enqueueEmbeddingJob('rote', noteId, ownerId, 'upsert', true);
    // Fault injection is confined to the explicitly disposable integration database.
    await db.execute(
      sql`CREATE FUNCTION reject_embedding_test_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture insert failure'; END; $$`
    );
    try {
      await db.execute(
        sql`CREATE TRIGGER reject_embedding_test_insert BEFORE INSERT ON document_embeddings FOR EACH ROW EXECUTE FUNCTION reject_embedding_test_insert()`
      );
      await processPendingEmbeddingJobs();
      expect(await db.select().from(documentEmbeddings)).toEqual(previous);
      expect((await getEmbeddingJobStats()).failed).toBe(1);
      expect((await readAiSnapshot()).state.status).toBe('ready');
    } finally {
      await db.execute(
        sql`DROP TRIGGER IF EXISTS reject_embedding_test_insert ON document_embeddings`
      );
      await db.execute(sql`DROP FUNCTION reject_embedding_test_insert()`);
    }
    await retryFailedEmbeddingJobs();
    await processPendingEmbeddingJobs();
    expect((await db.select().from(documentEmbeddings))[0].text).toContain('changed source');
  });
  it('finishes an empty rebuild, and resumes scanning from its persisted cursor', async () => {
    const config = await saveConfig();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    await note();
    await db
      .insert(articles)
      .values({ id: articleId, authorId: ownerId, content: 'article fixture' });
    await startIndexRebuild(config.revision);
    await scanRebuildPage(1);
    expect((await readAiSnapshot()).state.scanCursor).toBe(noteId);
    await scanRebuildPage(1);
    expect((await readAiSnapshot()).state.scanSource).toBe('article');
    await completeRebuild();
    expect((await getEmbeddingJobStats()).succeeded).toBe(2);
  });
  it('rejects late results after lease reclamation and prevents concurrent jobs for one source', async () => {
    const config = await saveConfig();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    await note();
    await enqueueEmbeddingJob('rote', noteId, ownerId, 'upsert', true);
    const [one, two] = await Promise.all([claimEmbeddingJob(), claimEmbeddingJob()]);
    const first = one || two;
    expect(Number(Boolean(one)) + Number(Boolean(two))).toBe(1);
    await db
      .update(embeddingJobs)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(embeddingJobs.id, first!.job.id));
    const second = await claimEmbeddingJob();
    expect(second!.job.leaseToken).not.toBe(first!.job.leaseToken);
    await expect(processEmbeddingJob(first!.job, first!.config, 3)).rejects.toMatchObject({
      code: 'embedding_lease_lost',
    });
    await processEmbeddingJob(second!.job, second!.config, 3);
    expect(await db.select().from(documentEmbeddings)).toHaveLength(1);
  });
  it('does not let an expired worker delete retained vectors when its source disappears', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    await enqueueEmbeddingJob('rote', noteId, ownerId, 'upsert', true);
    const claim = await claimEmbeddingJob();
    await db.delete(rotes).where(eq(rotes.id, noteId));
    await db
      .update(embeddingJobs)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(embeddingJobs.id, claim!.job.id));
    await expect(processEmbeddingJob(claim!.job, claim!.config, 3)).rejects.toMatchObject({
      code: 'embedding_lease_lost',
    });
    expect(await db.select().from(documentEmbeddings)).toHaveLength(1);
    await processPendingEmbeddingJobs();
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
  });
  it('requeues a changed source and captures changes during rebuild with auto indexing disabled', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await scanRebuildPage();
    const claimed = await claimEmbeddingJob();
    globalThis.fetch = (async () => {
      await note('updated while embedding');
      return Response.json({ data: [{ embedding: [0.1, 0.1, 0.1] }] });
    }) as typeof fetch;
    await processEmbeddingJob(claimed!.job, claimed!.config, 3);
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
    expect((await getEmbeddingJobStats()).pending).toBe(1);
    provider();
    await enqueueEmbeddingJob('rote', noteId, ownerId);
    await completeRebuild();
    expect((await db.select().from(documentEmbeddings))[0].text).toContain(
      'updated while embedding'
    );
  });
  it('does not replace existing vectors on provider failure and blocks readiness until failed rebuild jobs recover', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    const oldGeneration = (await readAiSnapshot()).state.generationId;
    await startIndexRebuild(config.revision);
    globalThis.fetch = (async () => Response.json({}, { status: 400 })) as typeof fetch;
    await processPendingEmbeddingJobs();
    expect((await readAiSnapshot()).state.status).toBe('failed');
    expect((await db.select().from(documentEmbeddings))[0].generationId).toBe(oldGeneration);
    provider();
    await retryFailedEmbeddingJobs();
    await completeRebuild();
    const retained = await db.select().from(documentEmbeddings);
    expect(retained).toHaveLength(1);
    expect(retained[0].generationId).not.toBe(oldGeneration);
  });
  it('discards deleted sources and results from an obsolete generation', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await scanRebuildPage();
    const claimed = await claimEmbeddingJob();
    globalThis.fetch = (async () => {
      await db.delete(rotes).where(eq(rotes.id, noteId));
      return Response.json({ data: [{ embedding: [0.1, 0.1, 0.1] }] });
    }) as typeof fetch;
    await processEmbeddingJob(claimed!.job, claimed!.config, 3);
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
    provider();
    await note();
    await enqueueEmbeddingJob('rote', noteId, ownerId);
    const stale = await claimEmbeddingJob();
    await saveAiSettings({ ...config, embedding: { ...config.embedding, model: 'next-model' } });
    await expect(processEmbeddingJob(stale!.job, stale!.config, 3)).rejects.toMatchObject({
      code: 'embedding_lease_lost',
    });
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
  });
  it('invalidates verified state when a native model changes its output dimensions', async () => {
    const config = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await completeRebuild();
    provider(4);
    await expect(
      semanticSearch({ query: 'test', ownerId, viewerId: ownerId })
    ).rejects.toMatchObject({ code: 'embedding_dimensions_mismatch' });
    expect((await readAiSnapshot()).state.status).toBe('needs_validation');
  });
  it('commits source events atomically, resumes failed rebuilds and cleans deleted generations', async () => {
    const config = await saveConfig();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(rotes).values({ id: noteId, authorid: ownerId, content: 'rolled back' });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(0);
    await note(); // No application enqueue: the committed outbox survives restart.
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(1);
    globalThis.fetch = (async () => Response.json({}, { status: 400 })) as typeof fetch;
    await processPendingEmbeddingJobs();
    expect((await readAiSnapshot()).state.status).toBe('failed');
    await note('updated while rebuild failed');
    await processPendingEmbeddingJobs();
    expect((await getEmbeddingJobStats()).pending).toBe(1);
    provider();
    await retryFailedEmbeddingJobs();
    await completeRebuild();
    expect((await db.select().from(documentEmbeddings))[0].text).toContain(
      'updated while rebuild failed'
    );
    await db.delete(rotes).where(eq(rotes.id, noteId));
    await processPendingEmbeddingJobs();
    expect(await db.select().from(documentEmbeddings)).toHaveLength(0);
  });
  it('bounds expired lease reclamation without another model request', async () => {
    const config = await saveConfig();
    await ensurePgvectorReady();
    await startIndexRebuild(config.revision);
    await note();
    const { consumeSourceEvents } = await import('./sourceEvents');
    await consumeSourceEvents();
    await scanRebuildPage();
    const claim = await claimEmbeddingJob();
    await db
      .update(embeddingJobs)
      .set({ attempts: config.indexing.maxRetries, leaseExpiresAt: new Date(0) })
      .where(eq(embeddingJobs.id, claim!.job.id));
    const count = requests.length;
    await processPendingEmbeddingJobs();
    expect(requests).toHaveLength(count);
    expect((await readAiSnapshot()).state.status).toBe('failed');
  });
  it('enforces authenticated API revision and verification contracts without mutating settings on test', async () => {
    const { Hono } = await import('hono');
    const { default: adminRouter } = await import('../route/v2/admin');
    const { registerAdminAiRoutes } = await import('../route/v2/aiAdmin');
    const { errorHandler } = await import('../utils/handlers');
    const { setConfig } = await import('../utils/config');
    const { generateAccessToken } = await import('../utils/jwt');
    await setConfig('security', {
      jwtSecret: 'embedding-test-only-jwt-signing-key',
      jwtRefreshSecret: 'embedding-test-only-refresh-key',
      sessionSecret: 'embedding-test-session',
    });
    const token = await generateAccessToken({ userId: ownerId, username: 'embedding-fixture' });
    const app = new Hono<{ Variables: import('../types/hono').HonoVariables }>();
    const ai = new Hono<{ Variables: import('../types/hono').HonoVariables }>();
    registerAdminAiRoutes(ai);
    app.route('/ai', ai).route('/admin', adminRouter).onError(errorHandler);
    const request = (path: string, method: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect((await app.request('/ai/test', { method: 'POST' })).status).toBe(401);
    const config = await saveConfig();
    const initial = await readAiSnapshot();
    const tested = await request('/ai/test', 'POST', { target: 'embedding', config });
    expect(tested.status).toBe(200);
    expect((await tested.json()).data).toMatchObject({ dimensions: 3, output: { mode: 'native' } });
    expect(await readAiSnapshot()).toEqual(initial);
    expect(
      (
        await request('/ai/test', 'POST', {
          target: 'embedding',
          config: {
            ...config,
            embedding: {
              ...config.embedding,
              apiKey: '********',
              baseUrl: 'https://another.test/v1',
            },
          },
        })
      ).status
    ).toBe(400);
    expect(
      (await request('/admin/settings', 'PUT', { group: 'ai', config: { ...config, revision: 0 } }))
        .status
    ).toBe(409);
    provider(2001);
    const failed = await request('/admin/settings', 'PUT', {
      group: 'ai',
      config: { ...config, embedding: { ...config.embedding, model: 'oversized' } },
    });
    expect(failed.status).toBe(422);
    expect((await failed.json()).data).toMatchObject({ actual: 2001, limit: 2000 });
    expect((await readAiSnapshot()).config).toEqual(config);
    provider();
    await ensurePgvectorReady();
    expect((await request('/ai/index/rebuild', 'POST', { revision: config.revision })).status).toBe(
      202
    );
    expect((await request('/ai/index/rebuild', 'POST', { revision: 0 })).status).toBe(409);
    const read = await request('/admin/settings?group=ai', 'GET');
    expect((await read.json()).data.config.revision).toBe(config.revision);
  });
});

const { getAiConfigurationImpact } = await import('./configImpact');
const { consumeSourceEvents } = await import('./sourceEvents');
const { recoverLegacyIndex } = await import('./legacyIndexRecovery');

async function legacyFixture() {
  const config = await saveConfig();
  await note();
  await ensurePgvectorReady();
  await startIndexRebuild(config.revision);
  await completeRebuild();
  await db.update(documentEmbeddings).set({ generationId: null });
  await db
    .update(embeddingIndexState)
    .set({
      generationId: null,
      generationFingerprint: null,
      generationDimensions: null,
      generationReusable: false,
      status: 'needs_rebuild',
      scanComplete: false,
    })
    .where(eq(embeddingIndexState.id, 1));
  return config;
}

describe.serial('configuration changes and retained index recovery', () => {
  it('previews embedding changes without saving or calling a provider', async () => {
    const saved = await saveConfig();
    const count = requests.length;
    for (const config of [
      saved,
      { ...saved, chat: { ...saved.chat, model: 'another-chat' } },
      { ...saved, embedding: { ...saved.embedding, apiKey: 'rotated' } },
      { ...saved, indexing: { ...saved.indexing, batchSize: 2 } },
    ])
      expect((await getAiConfigurationImpact(config)).requiresConfirmation).toBe(false);
    for (const config of [
      { ...saved, embedding: { ...saved.embedding, model: 'another-model' } },
      {
        ...saved,
        embedding: { ...saved.embedding, output: { mode: 'dimensions' as const, dimensions: 3 } },
      },
      { ...saved, indexing: { ...saved.indexing, chunkOverlap: 100 } },
    ])
      expect((await getAiConfigurationImpact(config)).requiresConfirmation).toBe(true);
    await expect(getAiConfigurationImpact({ ...saved, revision: 0 })).rejects.toMatchObject({
      code: 'embedding_revision_conflict',
    });
    expect(requests).toHaveLength(count);
    expect((await readAiSnapshot()).config).toEqual(saved);
  });
  it('restores the retained generation after switching back without regenerating content', async () => {
    const original = await saveConfig();
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(original.revision);
    await completeRebuild();
    const vectors = await db.select().from(documentEmbeddings);
    const generation = (await readAiSnapshot()).state.generationId;
    const changed = await saveAiSettings({
      ...original,
      embedding: { ...original.embedding, model: 'other-model' },
    });
    expect((await getPgvectorStatus()).ready).toBe(false);
    const count = requests.length;
    await saveAiSettings({ ...original, revision: changed.revision });
    expect(requests).toHaveLength(count + 1); // Validation only.
    expect((await readAiSnapshot()).state).toMatchObject({
      status: 'ready',
      generationId: generation,
      generationReusable: true,
    });
    expect((await getPgvectorStatus()).ready).toBe(true);
    expect(await db.select().from(documentEmbeddings)).toEqual(vectors);
  });
  it('retains edits while a different model is saved and catches up with auto indexing disabled', async () => {
    const initial = await saveConfig();
    const original = await saveAiSettings({ ...initial, autoIndexEnabled: false });
    await note();
    await ensurePgvectorReady();
    await startIndexRebuild(original.revision);
    await completeRebuild();
    const generation = (await readAiSnapshot()).state.generationId;
    await enqueueEmbeddingJob('rote', noteId, ownerId, 'upsert', true);
    const expiredWorker = await claimEmbeddingJob();
    expect(expiredWorker).toBeTruthy();
    const changed = await saveAiSettings({
      ...original,
      embedding: { ...original.embedding, model: 'other-model' },
    });
    await note('edited while the model was different');
    await consumeSourceEvents();
    expect(await db.select().from(embeddingSourceEvents)).toHaveLength(1);
    await saveAiSettings({ ...original, revision: changed.revision });
    expect((await readAiSnapshot()).state).toMatchObject({
      status: 'rebuilding',
      generationId: generation,
      scanComplete: true,
    });
    await expect(
      processEmbeddingJob(
        expiredWorker!.job,
        expiredWorker!.config,
        expiredWorker!.state.dimensions!
      )
    ).rejects.toMatchObject({ code: 'embedding_lease_lost' });
    await completeRebuild();
    const rows = await db.select().from(documentEmbeddings);
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('edited while the model was different');
    expect(rows[0].generationId).toBe(generation);
  });
  it('does not restore a generation without a valid physical index', async () => {
    const original = await saveConfig();
    await ensurePgvectorReady();
    const index = await startIndexRebuild(original.revision);
    await completeRebuild();
    const changed = await saveAiSettings({
      ...original,
      embedding: { ...original.embedding, model: 'other-model' },
    });
    await db.execute(sql.raw(`DROP INDEX "${index.indexName}"`));
    await saveAiSettings({ ...original, revision: changed.revision });
    expect((await readAiSnapshot()).state.status).toBe('needs_rebuild');
  });
  it('explicitly adopts verified legacy vectors, preserving originals and only generating missing content', async () => {
    const config = await legacyFixture();
    const [old] = await db.select().from(documentEmbeddings);
    await db
      .insert(articles)
      .values({ id: articleId, authorId: ownerId, content: 'a missing article' });
    const options = { revision: config.revision, confirmedProvider: config.embedding.providerId };
    const preview = await recoverLegacyIndex(options);
    expect(preview).toMatchObject({ applied: false, reusableChunks: 1, incrementalSources: 1 });
    expect(await db.select().from(documentEmbeddings)).toEqual([old]);
    await expect(recoverLegacyIndex({ ...options, apply: true })).rejects.toMatchObject({
      code: 'embedding_legacy_incremental_limit',
    });
    expect((await readAiSnapshot()).state.generationId).toBeNull();
    const recovered = await recoverLegacyIndex({
      ...options,
      apply: true,
      maxIncrementalSources: 1,
    });
    const copies = await db.select().from(documentEmbeddings);
    expect(copies).toHaveLength(2);
    expect(copies.find((row) => row.id === old.id)).toEqual(old);
    expect(copies.find((row) => row.generationId === recovered.generationId)?.embedding).toBe(
      old.embedding
    );
    const count = requests.length;
    await completeRebuild();
    expect(requests).toHaveLength(count + 1);
    expect((await getPgvectorStatus()).ready).toBe(true);
    expect(await semanticSearch({ query: 'fixture', ownerId, viewerId: ownerId })).toHaveLength(2);
  });
  it('rejects unconfirmed provenance, stale revisions and incompatible model samples without changing data', async () => {
    const config = await legacyFixture();
    const options = {
      revision: config.revision,
      confirmedProvider: config.embedding.providerId,
      apply: true,
    };
    const previous = await db.select().from(documentEmbeddings);
    await expect(
      recoverLegacyIndex({ ...options, confirmedProvider: 'wrong-provider' })
    ).rejects.toMatchObject({ code: 'embedding_legacy_recovery_unavailable' });
    await expect(recoverLegacyIndex({ ...options, revision: 0 })).rejects.toMatchObject({
      code: 'embedding_revision_conflict',
    });
    globalThis.fetch = (async () =>
      Response.json({ data: [{ embedding: [1, 0, 0] }] })) as typeof fetch;
    await expect(recoverLegacyIndex(options)).rejects.toMatchObject({
      code: 'embedding_legacy_sample_mismatch',
    });
    expect(await db.select().from(documentEmbeddings)).toEqual(previous);
    expect((await readAiSnapshot()).state.status).toBe('needs_rebuild');
  });
});

it('rejects duplicate legacy chunks that conceal missing chunk coverage', async () => {
  const config = await legacyFixture();
  await note('a'.repeat(1900));
  const { hashText } = await import('../utils/dbMethods/ai/documents');
  const [old] = await db
    .update(documentEmbeddings)
    .set({ text: 'a'.repeat(1800), contentHash: hashText('a'.repeat(1800)) })
    .returning();
  await db.insert(documentEmbeddings).values({ ...old, id: crypto.randomUUID() });
  await expect(
    recoverLegacyIndex({
      revision: config.revision,
      confirmedProvider: config.embedding.providerId,
      apply: true,
    })
  ).rejects.toMatchObject({ code: 'embedding_legacy_recovery_unavailable' });
  expect((await readAiSnapshot()).state.generationId).toBeNull();
});
