import { withDatabaseAdvisoryLock } from '../utils/drizzle';
import {
  backfillLivePhotoCovers,
  type LivePhotoCoverBackfillOptions,
  type LivePhotoCoverBackfillResult,
} from './livePhotoCoverBackfill';

const LIVE_PHOTO_BACKFILL_LOCK = 'rote:live-photo-cover-backfill:v1';
export const LIVE_PHOTO_BACKFILL_BATCH_SIZE = 20;

type BackfillRunner = (
  _options: LivePhotoCoverBackfillOptions
) => Promise<LivePhotoCoverBackfillResult>;

type AdvisoryLockRunner = typeof withDatabaseAdvisoryLock;

export type AutomaticLivePhotoBackfillResult = Omit<
  LivePhotoCoverBackfillResult,
  'lastAttachmentId'
> & {
  acquiredLock: boolean;
};

export async function runAutomaticLivePhotoCoverBackfill(
  dependencyOverrides: {
    backfill?: BackfillRunner;
    withLock?: AdvisoryLockRunner;
  } = {}
): Promise<AutomaticLivePhotoBackfillResult> {
  const runBackfill = dependencyOverrides.backfill ?? backfillLivePhotoCovers;
  const withLock = dependencyOverrides.withLock ?? withDatabaseAdvisoryLock;
  const locked = await withLock(LIVE_PHOTO_BACKFILL_LOCK, async () => {
    let afterAttachmentId: string | undefined;
    const aggregate = { failed: 0, scanned: 0, skipped: 0, updated: 0 };

    while (true) {
      const batch = await runBackfill({
        afterAttachmentId,
        limit: LIVE_PHOTO_BACKFILL_BATCH_SIZE,
      });
      aggregate.failed += batch.failed;
      aggregate.scanned += batch.scanned;
      aggregate.skipped += batch.skipped;
      aggregate.updated += batch.updated;

      if (
        batch.scanned < LIVE_PHOTO_BACKFILL_BATCH_SIZE ||
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
    console.info('[live-photo-backfill] status=skipped reason=lock-held-by-another-instance');
    return { acquiredLock: false, failed: 0, scanned: 0, skipped: 0, updated: 0 };
  }

  // eslint-disable-next-line no-console
  console.info(
    `[live-photo-backfill] status=automatic-completed scanned=${locked.result.scanned} updated=${locked.result.updated} skipped=${locked.result.skipped} failed=${locked.result.failed}`
  );
  return { acquiredLock: true, ...locked.result };
}
