import { backfillHeicBrowserCovers } from '../attachments/heicBrowserCoverBackfill';
import { initializeConfig } from '../utils/config';
import { closeDatabase } from '../utils/drizzle';

function getOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (require.main === module) {
  initializeConfig()
    .then(() =>
      backfillHeicBrowserCovers({
        attachmentId: getOption('--attachment-id'),
        dryRun: process.argv.includes('--dry-run'),
        noteId: getOption('--note-id'),
      })
    )
    .then(async () => {
      await closeDatabase();
    })
    .catch(async (error) => {
      console.error('[heic-cover-backfill] status=fatal', error);
      await closeDatabase();
      process.exitCode = 1;
    });
}
