import { and, asc, eq, gt, isNull, or, sql, type SQL } from 'drizzle-orm';
import { attachments } from '../drizzle/schema';
import db from '../utils/drizzle';
import { ensureHeicBrowserCover } from './heicBrowserCover';
import { requireStorageAvailable } from './types';

export type HeicBrowserCoverBackfillOptions = {
  afterAttachmentId?: string;
  attachmentId?: string;
  dryRun?: boolean;
  limit?: number;
  noteId?: string;
};

export type HeicBrowserCoverBackfillResult = {
  failed: number;
  lastAttachmentId: string | null;
  scanned: number;
  skipped: number;
  updated: number;
};

export function isOwnedAttachmentOriginalKey(userId: string, originalKey: string): boolean {
  return originalKey.startsWith(`users/${userId}/uploads/`);
}

function getCandidateFilters(options: HeicBrowserCoverBackfillOptions): SQL[] {
  const filters: SQL[] = [
    sql`${attachments.details}->>'mediaKind' IN ('image', 'livePhoto')`,
    sql`${attachments.url} ~* ${'\\.(heic|heif)(\\?.*)?$'}`,
    or(
      isNull(attachments.compressUrl),
      eq(attachments.compressUrl, ''),
      sql`(${attachments.compressUrl} ~* ${'/compressed/[^/?]+\\.jpg(\\?.*)?$'} AND ${attachments.compressUrl} !~* ${'\\.v2\\.jpg(\\?.*)?$'})`
    )!,
    or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))!,
  ];
  if (options.afterAttachmentId) filters.push(gt(attachments.id, options.afterAttachmentId));
  if (options.attachmentId) filters.push(eq(attachments.id, options.attachmentId));
  if (options.noteId) filters.push(eq(attachments.roteid, options.noteId));
  return filters;
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
    `[heic-cover-backfill] status=started candidates=${candidates.length} dryRun=${Boolean(options.dryRun)} attachmentId=${options.attachmentId ?? 'all'} noteId=${options.noteId ?? 'all'} afterAttachmentId=${options.afterAttachmentId ?? 'start'} limit=${options.limit ?? 'all'}`
  );

  let failed = 0;
  let skipped = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const details = candidate.details as Record<string, unknown>;
    const originalKey = typeof details.key === 'string' ? details.key : '';
    if (!originalKey) {
      failed++;
      // eslint-disable-next-line no-console
      console.error(
        `[heic-cover-backfill] status=failed attachmentId=${candidate.id} originalKey=missing reason=details.key-is-empty`
      );
      continue;
    }
    if (!candidate.userId || !isOwnedAttachmentOriginalKey(candidate.userId, originalKey)) {
      skipped++;
      // eslint-disable-next-line no-console
      console.error(
        `[heic-cover-backfill] status=skipped attachmentId=${candidate.id} originalKey=${originalKey} reason=ownership-mismatch`
      );
      continue;
    }

    if (options.dryRun) {
      skipped++;
      // eslint-disable-next-line no-console
      console.info(
        `[heic-cover-backfill] status=dry-run attachmentId=${candidate.id} originalKey=${originalKey} writeback=skipped`
      );
      continue;
    }

    try {
      const cover = await ensureHeicBrowserCover(originalKey);
      const compressUrl = `${urlPrefix}/${cover.key}`;
      const writeback = await db
        .update(attachments)
        .set({
          compressUrl,
          details: { ...details, compressKey: cover.key },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attachments.id, candidate.id),
            candidate.compressUrl
              ? eq(attachments.compressUrl, candidate.compressUrl)
              : or(isNull(attachments.compressUrl), eq(attachments.compressUrl, '')),
            or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))
          )
        )
        .returning({ id: attachments.id });

      if (writeback.length === 0) {
        skipped++;
        // eslint-disable-next-line no-console
        console.info(
          `[heic-cover-backfill] status=skipped attachmentId=${candidate.id} originalKey=${originalKey} format=jpeg outputKey=${cover.key} outputBytes=${cover.size} writeback=already-updated`
        );
        continue;
      }

      updated++;
      // eslint-disable-next-line no-console
      console.info(
        `[heic-cover-backfill] status=updated attachmentId=${candidate.id} originalKey=${originalKey} format=jpeg outputKey=${cover.key} outputBytes=${cover.size} writeback=success`
      );
    } catch (error) {
      failed++;
      const reason = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(
        `[heic-cover-backfill] status=failed attachmentId=${candidate.id} originalKey=${originalKey} reason=${reason}`
      );
    }
  }

  const result = {
    failed,
    lastAttachmentId: candidates[candidates.length - 1]?.id ?? null,
    scanned: candidates.length,
    skipped,
    updated,
  };
  // eslint-disable-next-line no-console
  console.info(
    `[heic-cover-backfill] status=completed scanned=${result.scanned} updated=${updated} skipped=${skipped} failed=${failed} lastAttachmentId=${result.lastAttachmentId ?? 'none'}`
  );
  return result;
}
