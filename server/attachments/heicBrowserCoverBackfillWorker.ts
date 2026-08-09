import { withDatabaseAdvisoryLock } from '../utils/drizzle';
import {
  backfillHeicBrowserCovers,
  type HeicBrowserCoverBackfillOptions,
  type HeicBrowserCoverBackfillResult,
} from './heicBrowserCoverBackfill';

// Keep this identifier stable across the module rename so old and new server
// versions remain mutually exclusive during rolling deployments.
const HEIC_COVER_BACKFILL_LOCK = 'rote:live-photo-cover-backfill:v1';
export const HEIC_COVER_BACKFILL_BATCH_SIZE = 20;

type BackfillRunner = (
  _options: HeicBrowserCoverBackfillOptions
) => Promise<HeicBrowserCoverBackfillResult>;

type AdvisoryLockRunner = typeof withDatabaseAdvisoryLock;

export type AutomaticHeicCoverBackfillResult = Omit<
  HeicBrowserCoverBackfillResult,
  'lastAttachmentId'
> & {
  acquiredLock: boolean;
};

export async function runAutomaticHeicBrowserCoverBackfill(
  dependencyOverrides: {
    backfill?: BackfillRunner;
    withLock?: AdvisoryLockRunner;
  } = {}
): Promise<AutomaticHeicCoverBackfillResult> {
  const runBackfill = dependencyOverrides.backfill ?? backfillHeicBrowserCovers;
  const withLock = dependencyOverrides.withLock ?? withDatabaseAdvisoryLock;
  const locked = await withLock(HEIC_COVER_BACKFILL_LOCK, async () => {
    let afterAttachmentId: string | undefined;
    const aggregate = { detectedHeic: 0, failed: 0, scanned: 0, skipped: 0, updated: 0 };

    while (true) {
      const batch = await runBackfill({
        afterAttachmentId,
        limit: HEIC_COVER_BACKFILL_BATCH_SIZE,
      });
      aggregate.detectedHeic += batch.detectedHeic;
      aggregate.failed += batch.failed;
      aggregate.scanned += batch.scanned;
      aggregate.skipped += batch.skipped;
      aggregate.updated += batch.updated;

      if (
        batch.scanned < HEIC_COVER_BACKFILL_BATCH_SIZE ||
        !batch.lastAttachmentId ||
        batch.lastAttachmentId === afterAttachmentId
      ) {
        break;
      }
      afterAttachmentId = batch.lastAttachmentId;
    }

    return aggregate;
  });

  if (!locked.acquired) {
    // eslint-disable-next-line no-console
    console.info('[heic-cover-backfill] status=skipped reason=lock-held-by-another-instance');
    return {
      acquiredLock: false,
      detectedHeic: 0,
      failed: 0,
      scanned: 0,
      skipped: 0,
      updated: 0,
    };
  }

  // eslint-disable-next-line no-console
  console.info(
    `[heic-cover-backfill] status=automatic-completed scanned=${locked.result.scanned} detectedHeic=${locked.result.detectedHeic} updated=${locked.result.updated} skipped=${locked.result.skipped} failed=${locked.result.failed}`
  );
  return { acquiredLock: true, ...locked.result };
}
