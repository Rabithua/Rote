import { assertPushNotificationsEnabled } from './push/config';
import { runPushWorkerIteration } from './push/worker';
import { runMigrations, waitForDatabase } from './utils/drizzle';

async function main(): Promise<void> {
  assertPushNotificationsEnabled();
  await waitForDatabase();
  await runMigrations();

  // eslint-disable-next-line no-console
  console.log('Apple Push Notification worker started');
  while (true) {
    try {
      await runPushWorkerIteration();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Push worker iteration failed', error);
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}

void main();
