import { startPushWorkerRuntime } from './push/runtime';
import { runMigrations, waitForDatabase } from './utils/drizzle';

async function main(): Promise<void> {
  await waitForDatabase();
  await runMigrations();
  await startPushWorkerRuntime();
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Apple Push Notification worker', error);
  process.exit(1);
});
