import { parseIncomingAiConfig } from '../../embeddings/configStore';
import { getAiConfigurationImpact } from '../../embeddings/configImpact';
import { startIndexRebuild } from '../../embeddings/indexLifecycle';
import { DEFAULT_AI_CONFIG } from '../../utils/ai/providers';
import type { Hono } from 'hono';
import { authenticateJWT, requireAdmin } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { testChatProvider, testEmbeddingProvider } from '../../utils/ai/client';
import { AI_PROVIDER_PRESETS, resolveIncomingAiConfig } from '../../utils/ai/providers';
import {
  clearAllEmbeddings,
  enqueueBackfillEmbeddingJobs,
  ensurePgvectorReady,
  getEmbeddingJobStats,
  getPgvectorStatus,
  getStoredAiConfig,
  processPendingEmbeddingJobs,
  retryFailedEmbeddingJobs,
  setIndexingPaused,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse } from '../../utils/main';

export function registerAdminAiRoutes(router: Hono<{ Variables: HonoVariables }>) {
  router.post(
    '/config/impact',
    authenticateJWT,
    requireAdmin,
    bodyTypeCheck,
    async (c: HonoContext) => {
      const { config } = await c.req.json();
      return c.json(createResponse(await getAiConfigurationImpact(config)), 200);
    }
  );
  router.get('/defaults', authenticateJWT, requireAdmin, (c: HonoContext) =>
    c.json(createResponse(DEFAULT_AI_CONFIG), 200)
  );

  router.get('/providers', authenticateJWT, requireAdmin, (c: HonoContext) =>
    c.json(createResponse(AI_PROVIDER_PRESETS), 200)
  );

  router.post('/test', authenticateJWT, requireAdmin, bodyTypeCheck, async (c: HonoContext) => {
    const body = await c.req.json();
    const target = body?.target as 'chat' | 'embedding';
    const storedConfig = await getStoredAiConfig();
    const config = body?.config
      ? target === 'embedding'
        ? parseIncomingAiConfig(body.config, storedConfig)
        : resolveIncomingAiConfig(body.config, storedConfig)
      : storedConfig;

    if (target === 'chat') {
      await testChatProvider(config.chat);
      return c.json(createResponse({ success: true }, 'Chat provider test successful'), 200);
    }

    if (target === 'embedding') {
      const result = await testEmbeddingProvider(config.embedding);
      return c.json(
        createResponse(
          { success: true, ...result, database: await getPgvectorStatus() },
          'Embedding provider test successful'
        ),
        200
      );
    }

    return c.json(createResponse(null, 'Invalid test target'), 400);
  });

  router.get('/vector/status', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const status = await getPgvectorStatus();
    return c.json(createResponse(status), 200);
  });

  router.post('/vector/enable', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const status = await ensurePgvectorReady();
    return c.json(createResponse(status, 'pgvector is ready'), 200);
  });

  router.get('/index/stats', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const stats = await getEmbeddingJobStats();
    return c.json(createResponse(stats), 200);
  });

  router.post(
    '/index/rebuild',
    authenticateJWT,
    requireAdmin,
    bodyTypeCheck,
    async (c: HonoContext) => {
      const { revision } = await c.req.json();
      return c.json(createResponse(await startIndexRebuild(revision)), 202);
    }
  );

  router.post('/index/backfill', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const result = await enqueueBackfillEmbeddingJobs();
    const stats = await getEmbeddingJobStats();
    return c.json(createResponse({ ...result, stats }, 'Backfill jobs queued'), 200);
  });

  router.post('/index/process', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const result = await processPendingEmbeddingJobs();
    const stats = await getEmbeddingJobStats();
    return c.json(createResponse({ ...result, stats }, 'Embedding jobs processed'), 200);
  });

  router.post('/index/retry-failed', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const result = await retryFailedEmbeddingJobs();
    const stats = await getEmbeddingJobStats();
    return c.json(createResponse({ ...result, stats }, 'Failed jobs requeued'), 200);
  });

  router.post('/index/pause', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const config = await setIndexingPaused(true);
    return c.json(
      createResponse({ paused: config.indexing.paused === true }, 'Indexing paused'),
      200
    );
  });

  router.post('/index/resume', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    const config = await setIndexingPaused(false);
    return c.json(
      createResponse({ paused: config.indexing.paused === true }, 'Indexing resumed'),
      200
    );
  });

  router.post('/index/clear', authenticateJWT, requireAdmin, async (c: HonoContext) => {
    await clearAllEmbeddings();
    return c.json(createResponse(null, 'Vector index cleared'), 200);
  });
}
