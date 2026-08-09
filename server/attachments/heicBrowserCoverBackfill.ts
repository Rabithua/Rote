import { and, asc, eq, gt, isNull, or, sql, type SQL } from 'drizzle-orm';
import { attachments } from '../drizzle/schema';
import db from '../utils/drizzle';
import { ensureHeicBrowserCover, type EnsureHeicBrowserCoverResult } from './heicBrowserCover';
import { detectStoredImageContentTypeByKey } from './storedImageContent';
import { requireStorageAvailable } from './types';

export type HeicBrowserCoverBackfillOptions = {
  afterAttachmentId?: string;
  attachmentId?: string;
  detectMislabelled?: boolean;
  dryRun?: boolean;
  limit?: number;
  noteId?: string;
};

export type HeicBrowserCoverBackfillResult = {
  detectedHeic: number;
  failed: number;
  lastAttachmentId: string | null;
  scanned: number;
  skipped: number;
  updated: number;
};

export type HeicBrowserCoverBackfillCandidate = {
  compressUrl: string | null;
  details: unknown;
  id: string;
  url: string;
  userId: string | null;
};

export type HeicBrowserCoverCandidateResult = {
  cover?: EnsureHeicBrowserCoverResult;
  detectedHeic: boolean;
  reason: string;
  status: 'failed' | 'skipped' | 'updated';
};

export type HeicBrowserCoverCandidateDependencies = {
  detectStoredImageContentTypeByKey: typeof detectStoredImageContentTypeByKey;
  ensureHeicBrowserCover: typeof ensureHeicBrowserCover;
  writeback: (_input: {
    candidate: HeicBrowserCoverBackfillCandidate;
    compressUrl: string;
    details: Record<string, unknown>;
    originalKey: string;
  }) => Promise<boolean>;
};

export function isOwnedAttachmentOriginalKey(userId: string, originalKey: string): boolean {
  return originalKey.startsWith(`users/${userId}/uploads/`);
}

function getCandidateFilters(options: HeicBrowserCoverBackfillOptions): SQL[] {
  const previewNeedsRepair = or(
    isNull(attachments.compressUrl),
    eq(attachments.compressUrl, ''),
    sql`${attachments.compressUrl} = ${attachments.url}`,
    sql`(${attachments.compressUrl} ~* ${String.raw`/compressed/[^/?]+\.jpg(\?.*)?$`} AND ${attachments.compressUrl} !~* ${String.raw`\.v2\.jpg(\?.*)?$`})`
  )!;
  const filters: SQL[] = [
    sql`${attachments.details}->>'mediaKind' IN ('image', 'livePhoto')`,
    previewNeedsRepair,
    or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))!,
  ];
  if (!options.detectMislabelled) {
    filters.push(sql`${attachments.url} ~* ${String.raw`\.(heic|heif)(\?.*)?$`}`);
  }
  if (options.afterAttachmentId) filters.push(gt(attachments.id, options.afterAttachmentId));
  if (options.attachmentId) filters.push(eq(attachments.id, options.attachmentId));
  if (options.noteId) filters.push(eq(attachments.roteid, options.noteId));
  return filters;
}

export async function processHeicBrowserCoverCandidate(
  candidate: HeicBrowserCoverBackfillCandidate,
  options: Pick<HeicBrowserCoverBackfillOptions, 'detectMislabelled' | 'dryRun'> & {
    urlPrefix: string;
  },
  dependencies: HeicBrowserCoverCandidateDependencies
): Promise<HeicBrowserCoverCandidateResult> {
  const details =
    candidate.details && typeof candidate.details === 'object' && !Array.isArray(candidate.details)
      ? (candidate.details as Record<string, unknown>)
      : {};
  const originalKey = typeof details.key === 'string' ? details.key : '';
  if (!originalKey) {
    return { detectedHeic: false, reason: 'details.key-is-empty', status: 'failed' };
  }
  if (!candidate.userId || !isOwnedAttachmentOriginalKey(candidate.userId, originalKey)) {
    return { detectedHeic: false, reason: 'ownership-mismatch', status: 'skipped' };
  }

  try {
    if (options.detectMislabelled) {
      const detected = await dependencies.detectStoredImageContentTypeByKey(originalKey);
      if (detected !== 'image/heic') {
        return {
          detectedHeic: false,
          reason: `detected-${detected ?? 'unknown'}`,
          status: 'skipped',
        };
      }
    }

    if (options.dryRun) {
      return { detectedHeic: true, reason: 'dry-run', status: 'skipped' };
    }

    const cover = await dependencies.ensureHeicBrowserCover(originalKey);
    const compressUrl = `${options.urlPrefix}/${cover.key}`;
    const updated = await dependencies.writeback({
      candidate,
      compressUrl,
      details: { ...details, compressKey: cover.key, mimetype: 'image/heic' },
      originalKey,
    });
    return updated
      ? { cover, detectedHeic: true, reason: 'writeback-success', status: 'updated' }
      : { cover, detectedHeic: true, reason: 'already-updated', status: 'skipped' };
  } catch (error) {
    return {
      detectedHeic: false,
      reason: error instanceof Error ? error.message : String(error),
      status: 'failed',
    };
  }
}

export async function backfillHeicBrowserCovers(
  options: HeicBrowserCoverBackfillOptions = {}
): Promise<HeicBrowserCoverBackfillResult> {
  const storageConfig = requireStorageAvailable();
  const urlPrefix = storageConfig.urlPrefix.replace(/\/+$/, '');
  const query = db
    .select({
      compressUrl: attachments.compressUrl,
      details: attachments.details,
      id: attachments.id,
      url: attachments.url,
      userId: attachments.userid,
    })
    .from(attachments)
    .where(and(...getCandidateFilters(options)))
    .orderBy(asc(attachments.id));
  const candidates = options.limit ? await query.limit(options.limit) : await query;

  // eslint-disable-next-line no-console
  console.info(
    `[heic-cover-backfill] status=started candidates=${candidates.length} detectMislabelled=${Boolean(options.detectMislabelled)} dryRun=${Boolean(options.dryRun)} attachmentId=${options.attachmentId ?? 'all'} noteId=${options.noteId ?? 'all'} afterAttachmentId=${options.afterAttachmentId ?? 'start'} limit=${options.limit ?? 'all'}`
  );

  let detectedHeic = 0;
  let failed = 0;
  let skipped = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const result = await processHeicBrowserCoverCandidate(
      candidate,
      { detectMislabelled: options.detectMislabelled, dryRun: options.dryRun, urlPrefix },
      {
        detectStoredImageContentTypeByKey,
        ensureHeicBrowserCover,
        writeback: async ({ candidate, compressUrl, details, originalKey }) => {
          const writeback = await db
            .update(attachments)
            .set({ compressUrl, details, updatedAt: new Date() })
            .where(
              and(
                eq(attachments.id, candidate.id),
                eq(attachments.url, candidate.url),
                eq(attachments.userid, candidate.userId!),
                eq(attachments.details, candidate.details),
                sql`${attachments.details}->>'key' = ${originalKey}`,
                candidate.compressUrl
                  ? eq(attachments.compressUrl, candidate.compressUrl)
                  : or(isNull(attachments.compressUrl), eq(attachments.compressUrl, '')),
                or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))
              )
            )
            .returning({ id: attachments.id });
          return writeback.length > 0;
        },
      }
    );

    if (result.detectedHeic) detectedHeic++;
    if (result.status === 'failed') failed++;
    if (result.status === 'skipped') skipped++;
    if (result.status === 'updated') updated++;
    const details = candidate.details as Record<string, unknown>;
    const originalKey = typeof details.key === 'string' ? details.key : 'missing';
    const coverDetails = result.cover
      ? ` outputKey=${result.cover.key} outputBytes=${result.cover.size}`
      : '';
    if (result.status === 'failed') {
      // eslint-disable-next-line no-console
      console.error(
        `[heic-cover-backfill] status=${result.status} attachmentId=${candidate.id} originalKey=${originalKey} detectedHeic=${result.detectedHeic} reason=${result.reason}${coverDetails}`
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        `[heic-cover-backfill] status=${result.status} attachmentId=${candidate.id} originalKey=${originalKey} detectedHeic=${result.detectedHeic} reason=${result.reason}${coverDetails}`
      );
    }
  }

  const result = {
    detectedHeic,
    failed,
    lastAttachmentId: candidates[candidates.length - 1]?.id ?? null,
    scanned: candidates.length,
    skipped,
    updated,
  };
  // eslint-disable-next-line no-console
  console.info(
    `[heic-cover-backfill] status=completed scanned=${result.scanned} detectedHeic=${detectedHeic} updated=${updated} skipped=${skipped} failed=${failed} lastAttachmentId=${result.lastAttachmentId ?? 'none'}`
  );
  return result;
}
