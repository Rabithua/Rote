import {
  backfillHeicBrowserCovers,
  type HeicBrowserCoverBackfillOptions,
  type HeicBrowserCoverBackfillResult,
} from '../attachments/heicBrowserCoverBackfill';
import { initializeConfig } from '../utils/config';
import { closeDatabase } from '../utils/drizzle';

const DEFAULT_BATCH_SIZE = 20;

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getPositiveIntegerOption(name: string): number | undefined {
  const value = getOption(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function emptyAggregate(): Omit<HeicBrowserCoverBackfillResult, 'lastAttachmentId'> {
  return { detectedHeic: 0, failed: 0, scanned: 0, skipped: 0, updated: 0 };
}

function addBatch(
  aggregate: Omit<HeicBrowserCoverBackfillResult, 'lastAttachmentId'>,
  batch: HeicBrowserCoverBackfillResult
): void {
  aggregate.detectedHeic += batch.detectedHeic;
  aggregate.failed += batch.failed;
  aggregate.scanned += batch.scanned;
  aggregate.skipped += batch.skipped;
  aggregate.updated += batch.updated;
}

async function run(options: HeicBrowserCoverBackfillOptions, allBatches: boolean) {
  if (!allBatches) return backfillHeicBrowserCovers(options);

  const batchSize = options.limit ?? DEFAULT_BATCH_SIZE;
  const aggregate = emptyAggregate();
  let afterAttachmentId = options.afterAttachmentId;
  let lastAttachmentId: string | null = null;
  while (true) {
    const batch = await backfillHeicBrowserCovers({
      ...options,
      afterAttachmentId,
      limit: batchSize,
    });
    addBatch(aggregate, batch);
    lastAttachmentId = batch.lastAttachmentId;
    if (
      batch.scanned < batchSize ||
      !batch.lastAttachmentId ||
      batch.lastAttachmentId === afterAttachmentId
    ) {
      break;
    }
    afterAttachmentId = batch.lastAttachmentId;
  }

  const result = { ...aggregate, lastAttachmentId };
  console.info(
    `[heic-cover-backfill] status=all-batches-completed scanned=${result.scanned} detectedHeic=${result.detectedHeic} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} lastAttachmentId=${result.lastAttachmentId ?? 'none'}`
  );
  return result;
}

async function main(): Promise<void> {
  await initializeConfig();
  try {
    const result = await run(
      {
        afterAttachmentId: getOption('--after-attachment-id'),
        attachmentId: getOption('--attachment-id'),
        detectMislabelled: process.argv.includes('--detect-mislabelled'),
        dryRun: process.argv.includes('--dry-run'),
        limit: getPositiveIntegerOption('--limit'),
        noteId: getOption('--note-id'),
      },
      process.argv.includes('--all-batches')
    );
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[heic-cover-backfill] status=fatal', error);
    process.exitCode = 1;
  });
}
