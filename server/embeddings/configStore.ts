import { DrizzleQueryError, eq } from 'drizzle-orm';
import postgres from 'postgres';
import { z } from 'zod';
import { embeddingIndexState, settings } from '../drizzle/schema';
import type { AiConfig } from '../types/config';
import { mergeAiConfig, resolveIncomingAiConfig } from '../utils/ai/providers';
import { refreshConfigCache } from '../utils/config';
import db from '../utils/drizzle';
import { testEmbeddingProvider } from './client';
import { embeddingFingerprint, embeddingOutputSchema } from './contract';
import { EmbeddingError, isEmbeddingContractFailure } from './errors';
import {
  generationMatches,
  restoreGenerationStatus,
  revokeGenerationClaims,
} from './generationIdentity';

export type EmbeddingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type EmbeddingExecutor = typeof db | EmbeddingTransaction;
export type IndexState = typeof embeddingIndexState.$inferSelect;
const providerSchema = z.strictObject({
  providerId: z.string(),
  apiFormat: z.literal('openai_compatible').optional(),
  baseUrl: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
});
const configSchema = z.strictObject({
  schemaVersion: z.literal(2),
  revision: z.number().int().min(0),
  enabled: z.boolean(),
  vectorEnabled: z.boolean(),
  autoIndexEnabled: z.boolean(),
  publicExploreVectorEnabled: z.boolean(),
  chat: providerSchema,
  embedding: providerSchema.extend({ output: embeddingOutputSchema }),
  indexing: z.strictObject({
    chunkSize: z.number().int().min(500),
    chunkOverlap: z.number().int().min(0),
    batchSize: z.number().int().min(1).max(20),
    maxRetries: z.number().int().min(1).max(10),
    paused: z.boolean().optional(),
  }),
});
function configurationWriteFailed(error: unknown): never {
  if (error instanceof EmbeddingError) throw error;
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  const databaseCode = cause instanceof postgres.PostgresError ? cause.code : undefined;
  // Query errors include configuration values and credentials; log metadata only.
  // eslint-disable-next-line no-console -- Persistence failures need safe server diagnostics.
  console.error('AI configuration transaction failed', { databaseCode });
  throw new EmbeddingError(
    'embedding_settings_save_failed',
    500,
    databaseCode ? { databaseCode } : {}
  );
}
export async function readAiSnapshot(executor: EmbeddingExecutor = db) {
  const [row] = await executor
    .select({ config: settings.config, state: embeddingIndexState })
    .from(embeddingIndexState)
    .leftJoin(settings, eq(settings.group, 'ai'))
    .where(eq(embeddingIndexState.id, 1));
  if (!row) throw new EmbeddingError('embedding_state_missing', 503);
  return {
    config: {
      ...mergeAiConfig(row.config as Partial<AiConfig> | null),
      revision: row.state.revision,
    },
    state: row.state,
  };
}
export async function lockIndexState(tx: EmbeddingTransaction) {
  const [state] = await tx
    .select()
    .from(embeddingIndexState)
    .where(eq(embeddingIndexState.id, 1))
    .for('update');
  if (!state) throw new EmbeddingError('embedding_state_missing', 503);
  return state;
}
export async function getStoredAiConfig(): Promise<AiConfig> {
  return (await readAiSnapshot()).config;
}
export function canProcessIndex(config: AiConfig, state: IndexState) {
  return (
    config.enabled &&
    config.vectorEnabled &&
    state.generationId !== null &&
    state.dimensions !== null &&
    generationMatches(state, state.fingerprint, state.dimensions) &&
    (state.status === 'ready' || state.status === 'rebuilding')
  );
}
export function parseIncomingAiConfig(incoming: Partial<AiConfig>, stored: AiConfig): AiConfig {
  if (
    incoming.embedding?.apiKey === '********' &&
    (incoming.embedding.baseUrl !== stored.embedding.baseUrl ||
      incoming.embedding.providerId !== stored.embedding.providerId)
  )
    throw new EmbeddingError('embedding_config_invalid', 400);
  const parsed = configSchema.safeParse(resolveIncomingAiConfig(incoming, stored));
  if (!parsed.success) throw new EmbeddingError('embedding_config_invalid', 400);
  const next = parsed.data;
  if (next.indexing.chunkOverlap >= next.indexing.chunkSize)
    throw new EmbeddingError('embedding_config_invalid', 400);
  return next;
}
export async function saveAiSettings(incoming: Partial<AiConfig>): Promise<AiConfig> {
  const before = await readAiSnapshot();
  if (incoming.revision !== before.state.revision)
    throw new EmbeddingError('embedding_revision_conflict', 409);
  const next = parseIncomingAiConfig(incoming, before.config);
  const fingerprint = embeddingFingerprint(next);
  const identityChanged = fingerprint !== before.state.fingerprint;
  const keyChanged = next.embedding.apiKey !== before.config.embedding.apiKey;
  const enabledNow = next.enabled && next.vectorEnabled;
  const enabling = enabledNow && !(before.config.enabled && before.config.vectorEnabled);
  const contractFailed = isEmbeddingContractFailure(before.state.errorCode);
  const needsValidation =
    identityChanged ||
    keyChanged ||
    enabling ||
    contractFailed ||
    before.state.status === 'needs_validation';
  const verified =
    enabledNow && needsValidation ? await testEmbeddingProvider(next.embedding) : null;
  const invalidatesIndex =
    identityChanged || (verified !== null && verified.dimensions !== before.state.dimensions);
  await db
    .transaction(async (tx) => {
      const state = await lockIndexState(tx);
      if (state.revision !== incoming.revision)
        throw new EmbeddingError('embedding_revision_conflict', 409);
      if (invalidatesIndex || (!enabledNow && needsValidation))
        await revokeGenerationClaims(tx, state.generationId);
      const restored =
        verified &&
        !contractFailed &&
        (enabling || ['needs_rebuild', 'needs_validation'].includes(state.status))
          ? await restoreGenerationStatus(tx, state, fingerprint, verified.dimensions)
          : null;
      next.revision = state.revision + 1;
      await tx
        .insert(settings)
        .values({
          group: 'ai',
          config: next,
          isRequired: false,
          isSystem: false,
          isInitialized: true,
        })
        .onConflictDoUpdate({
          target: settings.group,
          set: { config: next, updatedAt: new Date() },
        });
      await tx
        .update(embeddingIndexState)
        .set({
          revision: next.revision,
          ...(verified
            ? {
                fingerprint,
                dimensions: verified.dimensions,
                validatedAt: new Date(),
                errorCode: null,
                errorDetails: null,
                status:
                  restored ??
                  (invalidatesIndex || contractFailed || state.status === 'needs_validation'
                    ? ('needs_rebuild' as const)
                    : state.status),
              }
            : needsValidation
              ? {
                  fingerprint: null,
                  dimensions: null,
                  status: 'needs_validation' as const,
                  validatedAt: null,
                  errorCode: null,
                  errorDetails: null,
                }
              : {}),
          updatedAt: new Date(),
        })
        .where(eq(embeddingIndexState.id, 1));
    })
    .catch(configurationWriteFailed);
  await refreshConfigCache();
  return next;
}
export async function setIndexingPaused(paused: boolean): Promise<AiConfig> {
  await db
    .transaction(async (tx) => {
      await lockIndexState(tx);
      const { config } = await readAiSnapshot(tx);
      config.indexing.paused = paused;
      config.revision += 1;
      await tx
        .insert(settings)
        .values({ group: 'ai', config, isInitialized: true })
        .onConflictDoUpdate({ target: settings.group, set: { config, updatedAt: new Date() } });
      await tx
        .update(embeddingIndexState)
        .set({ revision: config.revision, updatedAt: new Date() })
        .where(eq(embeddingIndexState.id, 1));
    })
    .catch(configurationWriteFailed);
  await refreshConfigCache();
  return getStoredAiConfig();
}
