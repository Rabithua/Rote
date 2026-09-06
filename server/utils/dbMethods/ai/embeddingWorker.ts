import { consumeSourceEvents } from '../../../embeddings/sourceEvents';
import { EmbeddingError } from '../../../embeddings/errors';
import { claimEmbeddingJob, failClaim } from '../../../embeddings/jobClaims';
import { processEmbeddingJob } from '../../../embeddings/jobProcessor';
import { finishIndexRebuild } from '../../../embeddings/indexLifecycle';
import { scanRebuildPage } from '../../../embeddings/rebuildScanner';
import { canProcessIndex, readAiSnapshot } from '../../../embeddings/configStore';
export { retryFailedEmbeddingJobs, clearAllEmbeddings } from '../../../embeddings/indexLifecycle';
export { setIndexingPaused } from '../../../embeddings/configStore';

export async function processPendingEmbeddingJobs(limit?: number) {
  await consumeSourceEvents();
  const { config, state } = await readAiSnapshot();
  if (!canProcessIndex(config, state) || config.indexing.paused)
    return { processed: 0, failed: 0, skipped: true };
  await scanRebuildPage();
  let processed = 0;
  let failed = 0;
  const batchSize = Math.min(Math.max(limit || config.indexing.batchSize, 1), 20);
  for (let i = 0; i < batchSize; i++) {
    const claim = await claimEmbeddingJob();
    if (!claim) break;
    try {
      if (claim.job.attempts > claim.config.indexing.maxRetries)
        throw new EmbeddingError('embedding_job_failed', 503);
      await processEmbeddingJob(claim.job, claim.config, claim.state.dimensions!);
      processed++;
    } catch (error) {
      await failClaim(claim.job, error, claim.config.indexing.maxRetries);
      failed++;
    }
  }
  await finishIndexRebuild();
  return { processed, failed, skipped: false };
}
