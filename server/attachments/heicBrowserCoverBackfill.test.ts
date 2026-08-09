import { describe, expect, it } from 'bun:test';
import type { HeicBrowserCoverBackfillCandidate } from './heicBrowserCoverBackfill';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { processHeicBrowserCoverCandidate } = await import('./heicBrowserCoverBackfill');

const candidate: HeicBrowserCoverBackfillCandidate = {
  compressUrl: 'https://cdn.example.com/users/user-1/uploads/photo.jpg',
  details: {
    key: 'users/user-1/uploads/photo.jpg',
    mediaKind: 'livePhoto',
    mimetype: 'image/jpeg',
  },
  id: 'attachment-1',
  url: 'https://cdn.example.com/users/user-1/uploads/photo.jpg',
  userId: 'user-1',
};

const cover = {
  contentType: 'image/jpeg' as const,
  key: 'users/user-1/compressed/photo.v2.jpg',
  size: 512,
  status: 'generated' as const,
};

describe('mislabelled HEIC backfill candidates', () => {
  it('inspects dry-run candidates without creating objects or writing data', async () => {
    const result = await processHeicBrowserCoverCandidate(
      candidate,
      { detectMislabelled: true, dryRun: true, urlPrefix: 'https://cdn.example.com' },
      {
        detectStoredImageContentTypeByKey: async () => 'image/heic',
        ensureHeicBrowserCover: async () => {
          throw new Error('dry-run must not create a cover');
        },
        writeback: async () => {
          throw new Error('dry-run must not write data');
        },
      }
    );

    expect(result).toEqual({ detectedHeic: true, reason: 'dry-run', status: 'skipped' });
  });

  it('skips JPEG objects discovered during a broad audit', async () => {
    const result = await processHeicBrowserCoverCandidate(
      candidate,
      { detectMislabelled: true, dryRun: false, urlPrefix: 'https://cdn.example.com' },
      {
        detectStoredImageContentTypeByKey: async () => 'image/jpeg',
        ensureHeicBrowserCover: async () => {
          throw new Error('JPEG must not create a HEIC cover');
        },
        writeback: async () => {
          throw new Error('JPEG must not write data');
        },
      }
    );

    expect(result).toEqual({
      detectedHeic: false,
      reason: 'detected-image/jpeg',
      status: 'skipped',
    });
  });

  it('does not overwrite an attachment changed concurrently', async () => {
    let writebackDetails: Record<string, unknown> | undefined;
    const result = await processHeicBrowserCoverCandidate(
      candidate,
      { detectMislabelled: true, dryRun: false, urlPrefix: 'https://cdn.example.com' },
      {
        detectStoredImageContentTypeByKey: async () => 'image/heic',
        ensureHeicBrowserCover: async () => cover,
        writeback: async ({ details }) => {
          writebackDetails = details;
          return false;
        },
      }
    );

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('already-updated');
    expect(result.detectedHeic).toBe(true);
    expect(writebackDetails?.mimetype).toBe('image/heic');
    expect(writebackDetails?.compressKey).toBe(cover.key);
  });
});
