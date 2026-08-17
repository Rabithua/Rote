import { validateApnsCredentials } from './apns';
import { assertPushNotificationsEnabled } from './config';
import { runPushWorkerIteration } from './worker';

const workerIntervalMs = 15_000;
let workerStarted = false;

async function runPushWorkerLoop(): Promise<never> {
  while (true) {
    try {
      await runPushWorkerIteration();
    } catch (error) {
      // An iteration can fail for transient database or APNs infrastructure reasons.
      // Keep the worker alive, while startup configuration failures remain fatal.
      // eslint-disable-next-line no-console
      console.error('Push worker iteration failed', error);
    }
    await new Promise((resolve) => setTimeout(resolve, workerIntervalMs));
  }
}

export async function startPushWorkerRuntime(): Promise<void> {
  assertPushNotificationsEnabled();
  if (workerStarted) return;
  await validateApnsCredentials();
  workerStarted = true;
  // eslint-disable-next-line no-console
  console.log('Apple Push Notification worker started');
  void runPushWorkerLoop();
}
