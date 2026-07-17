import { and, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { ensureLivePhotoCover } from '../attachments/livePhotoCover';
import { requireStorageAvailable } from '../attachments/types';
import { attachments } from '../drizzle/schema';
import { initializeConfig } from '../utils/config';
import db, { closeDatabase } from '../utils/drizzle';

type BackfillOptions = {
  attachmentId?: string;
  dryRun?: boolean;
  noteId?: string;
};

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getCandidateFilters(options: BackfillOptions): SQL[] {
  const filters: SQL[] = [
    sql`${attachments.details}->>'mediaKind' = 'livePhoto'`,
    sql`${attachments.url} ~* ${'\\.(heic|heif)(\\?.*)?$'}`,
    or(isNull(attachments.compressUrl), eq(attachments.compressUrl, ''))!,
    or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))!,
  ];
  if (options.attachmentId) filters.push(eq(attachments.id, options.attachmentId));
  if (options.noteId) filters.push(eq(attachments.roteid, options.noteId));
  return filters;
}

export async function backfillLivePhotoCovers(options: BackfillOptions = {}) {
  await initializeConfig();
  const storageConfig = requireStorageAvailable();
  const urlPrefix = storageConfig.urlPrefix.replace(/\/+$/, '');
  const candidates = await db
    .select({
      details: attachments.details,
      id: attachments.id,
      url: attachments.url,
    })
    .from(attachments)
    .where(and(...getCandidateFilters(options)));

  console.info(
    `[live-photo-backfill] status=started candidates=${candidates.length} dryRun=${Boolean(options.dryRun)} attachmentId=${options.attachmentId ?? 'all'} noteId=${options.noteId ?? 'all'}`
  );

  let failed = 0;
  let skipped = 0;
  let updated = 0;
  for (const candidate of candidates) {
    const details = candidate.details as Record<string, unknown>;
    const originalKey = typeof details.key === 'string' ? details.key : '';
    if (!originalKey) {
      failed++;
      console.error(
        `[live-photo-backfill] status=failed attachmentId=${candidate.id} originalKey=missing reason=details.key-is-empty`
      );
      continue;
    }

    if (options.dryRun) {
      skipped++;
      console.info(
        `[live-photo-backfill] status=dry-run attachmentId=${candidate.id} originalKey=${originalKey} writeback=skipped`
      );
      continue;
    }

    try {
      const cover = await ensureLivePhotoCover(originalKey);
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
            or(isNull(attachments.compressUrl), eq(attachments.compressUrl, '')),
            or(isNull(attachments.posterUrl), eq(attachments.posterUrl, ''))
          )
        )
        .returning({ id: attachments.id });

      if (writeback.length === 0) {
        skipped++;
        console.info(
          `[live-photo-backfill] status=skipped attachmentId=${candidate.id} originalKey=${originalKey} format=jpeg outputKey=${cover.key} outputBytes=${cover.size} writeback=already-updated`
        );
        continue;
      }

      updated++;
      console.info(
        `[live-photo-backfill] status=updated attachmentId=${candidate.id} originalKey=${originalKey} format=jpeg outputKey=${cover.key} outputBytes=${cover.size} writeback=success`
      );
    } catch (error) {
      failed++;
      const reason = error instanceof Error ? error.message : String(error);
      console.error(
        `[live-photo-backfill] status=failed attachmentId=${candidate.id} originalKey=${originalKey} reason=${reason}`
      );
    }
  }

  const result = { failed, scanned: candidates.length, skipped, updated };
  console.info(
    `[live-photo-backfill] status=completed scanned=${result.scanned} updated=${updated} skipped=${skipped} failed=${failed}`
  );
  return result;
}

if (require.main === module) {
  backfillLivePhotoCovers({
    attachmentId: getOption('--attachment-id'),
    dryRun: process.argv.includes('--dry-run'),
    noteId: getOption('--note-id'),
  })
    .then(async () => {
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error('[live-photo-backfill] status=fatal', error);
      await closeDatabase();
      process.exitCode = 1;
    });
}
