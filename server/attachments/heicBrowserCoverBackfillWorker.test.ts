import { describe, expect, it } from 'bun:test';
import type { DatabaseAdvisoryLockResult } from '../utils/drizzle';
import type {
  HeicBrowserCoverBackfillOptions,
  HeicBrowserCoverBackfillResult,
} from './heicBrowserCoverBackfill';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { HEIC_COVER_BACKFILL_BATCH_SIZE, runAutomaticHeicBrowserCoverBackfill } =
  await import('./heicBrowserCoverBackfillWorker');
const { isOwnedAttachmentOriginalKey } = await import('./heicBrowserCoverBackfill');

describe('automatic HEIC browser cover backfill', () => {
  it('only accepts original keys owned by the attachment user', () => {
    expect(
      isOwnedAttachmentOriginalKey(
        'user-1',
        'users/user-1/uploads/11111111-1111-4111-8111-111111111111.heic'
      )
    ).toBe(true);
    expect(
      isOwnedAttachmentOriginalKey(
        'user-1',
        'users/user-2/uploads/11111111-1111-4111-8111-111111111111.heic'
      )
    ).toBe(false);
  });

  it('processes candidates in cursor batches while holding one advisory lock', async () => {
    const calls: HeicBrowserCoverBackfillOptions[] = [];
    const results: HeicBrowserCoverBackfillResult[] = [
      {
        detectedHeic: 18,
        failed: 2,
        lastAttachmentId: 'attachment-020',
        scanned: HEIC_COVER_BACKFILL_BATCH_SIZE,
        skipped: 0,
        updated: 18,
      },
      {
        detectedHeic: 2,
        failed: 0,
        lastAttachmentId: 'attachment-023',
        scanned: 3,
        skipped: 1,
        updated: 2,
      },
    ];
    const withLock = async <T>(
      _lockName: string,
      task: () => Promise<T>
    ): Promise<DatabaseAdvisoryLockResult<T>> => ({ acquired: true, result: await task() });

    const result = await runAutomaticHeicBrowserCoverBackfill({
      backfill: async (options) => {
        calls.push(options);
        const next = results.shift();
        if (!next) throw new Error('unexpected extra batch');
        return next;
      },
      withLock,
    });

    expect(calls).toEqual([
      { afterAttachmentId: undefined, limit: HEIC_COVER_BACKFILL_BATCH_SIZE },
      { afterAttachmentId: 'attachment-020', limit: HEIC_COVER_BACKFILL_BATCH_SIZE },
    ]);
    expect(result).toEqual({
      acquiredLock: true,
      detectedHeic: 20,
      failed: 2,
      scanned: 23,
      skipped: 1,
      updated: 20,
    });
  });

  it('does no work when another server instance owns the advisory lock', async () => {
    let called = false;
    const withLock = async <T>(): Promise<DatabaseAdvisoryLockResult<T>> => ({
      acquired: false,
    });

    const result = await runAutomaticHeicBrowserCoverBackfill({
      backfill: async () => {
        called = true;
        throw new Error('backfill should not run');
      },
      withLock,
    });

    expect(called).toBe(false);
    expect(result).toEqual({
      acquiredLock: false,
      detectedHeic: 0,
      failed: 0,
      scanned: 0,
      skipped: 0,
      updated: 0,
    });
  });
});
