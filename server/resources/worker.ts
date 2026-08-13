import { and, count, eq, isNull, lte, sql } from 'drizzle-orm';
import {
  resourceCleanupOutbox,
  resourceStorageAccounts,
  resourceUploadReservations,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { r2deletehandler } from '../utils/r2';
import type { UploadReservationManifestItem } from './service';
import { billingConfig } from '../billing/runtimeConfig';

let started = false;

export async function runResourceMaintenance(now = new Date()) {
  const expired = await db
    .select()
    .from(resourceUploadReservations)
    .where(
      and(
        eq(resourceUploadReservations.status, 'pending'),
        lte(resourceUploadReservations.expiresAt, now)
      )
    )
    .limit(100);
  for (const reservation of expired) {
    await db.transaction(async (transaction) => {
      const [locked] = await transaction
        .select()
        .from(resourceUploadReservations)
        .where(eq(resourceUploadReservations.id, reservation.id))
        .limit(1)
        .for('update');
      if (!locked || locked.status !== 'pending' || locked.expiresAt > now) return;
      await transaction
        .update(resourceStorageAccounts)
        .set({
          reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${locked.reservedBytes})`,
          updatedAt: now,
        })
        .where(eq(resourceStorageAccounts.userId, locked.userId));
      const manifest = locked.manifest as UploadReservationManifestItem[];
      for (const objectKey of new Set(
        manifest.flatMap((item) => [item.stagingKey, item.finalKey])
      )) {
        await transaction
          .insert(resourceCleanupOutbox)
          .values({ storageIdentity: 'primary', objectKey })
          .onConflictDoNothing({
            target: [resourceCleanupOutbox.storageIdentity, resourceCleanupOutbox.objectKey],
          });
      }
      await transaction
        .update(resourceUploadReservations)
        .set({ status: 'expired' })
        .where(eq(resourceUploadReservations.id, locked.id));
    });
  }

  const cleanup = await db
    .select()
    .from(resourceCleanupOutbox)
    .where(
      and(isNull(resourceCleanupOutbox.completedAt), lte(resourceCleanupOutbox.nextAttemptAt, now))
    )
    .limit(100);
  for (const item of cleanup) {
    const deleted = await r2deletehandler(item.objectKey).catch(() => false);
    if (deleted) {
      await db
        .update(resourceCleanupOutbox)
        .set({ completedAt: new Date(), lastError: null })
        .where(eq(resourceCleanupOutbox.id, item.id));
      continue;
    }
    const attempts = item.attempts + 1;
    const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10));
    await db
      .update(resourceCleanupOutbox)
      .set({
        attempts,
        lastError: 'storage_delete_failed',
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
      })
      .where(eq(resourceCleanupOutbox.id, item.id));
  }

  const [backlog] = await db
    .select({ value: count() })
    .from(resourceCleanupOutbox)
    .where(isNull(resourceCleanupOutbox.completedAt));
  const threshold = Number(process.env.RESOURCE_CLEANUP_SAFETY_THRESHOLD ?? '10000');
  if (Number(backlog?.value ?? 0) >= threshold) {
    process.env.RESOURCE_MANAGED_STORAGE_SAFETY_FUSE = 'tripped';
    // Aggregate only: never log object keys or storage credentials.
    // eslint-disable-next-line no-console
    console.error('[managed-storage] cleanup_backlog_safety_fuse', {
      backlog: Number(backlog?.value ?? 0),
      threshold,
    });
  } else {
    delete process.env.RESOURCE_MANAGED_STORAGE_SAFETY_FUSE;
  }
}

export async function startResourceMaintenanceWorker() {
  if (started) return;
  if (!billingConfig.enabled) return;
  started = true;
  const run = () =>
    void runResourceMaintenance().catch((error) => {
      // Never include object keys, upload tokens or credentials in this log.
      // eslint-disable-next-line no-console
      console.error(
        '[managed-storage] maintenance_failed',
        error instanceof Error ? error.name : 'unknown'
      );
    });
  run();
  setInterval(run, 60_000).unref();
}
