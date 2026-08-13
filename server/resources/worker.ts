import { and, count, eq, isNull, lte, or, sql } from 'drizzle-orm';
import {
  attachments,
  resourceCleanupOutbox,
  resourceManagementState,
  resourceStorageAccounts,
  resourceStorageObjects,
  resourceUploadReservations,
  users,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { getObjectInfo, r2deletehandler } from '../utils/r2';
import type { UploadReservationManifestItem } from './service';
import { billingConfig } from '../billing/runtimeConfig';

type ReconciledObject = {
  key: string;
  role: UploadReservationManifestItem['role'];
  billable: boolean;
  references: number;
};

export function attachmentObjects(details: unknown, userId: string): ReconciledObject[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const value = details as Record<string, any>;
  const prefix = `users/${userId}/`;
  const entries: Array<[unknown, ReconciledObject['role'], boolean]> = [
    [value.key, 'original', true],
    [value.compressKey, 'compressed', false],
    [value.posterKey, 'poster', false],
    [
      value.pairedVideoKey ?? value.livePhotoVideoKey ?? value.livePhoto?.pairedVideoKey,
      'paired_video',
      true,
    ],
  ];
  const objects = new Map<string, ReconciledObject>();
  const rolePriority: Record<ReconciledObject['role'], number> = {
    original: 4,
    paired_video: 3,
    compressed: 2,
    poster: 1,
  };
  for (const [candidate, role, billable] of entries) {
    if (typeof candidate !== 'string' || !candidate.startsWith(prefix)) continue;
    const existing = objects.get(candidate);
    if (!existing) {
      objects.set(candidate, { key: candidate, role, billable, references: 1 });
      continue;
    }
    existing.billable ||= billable;
    if (rolePriority[role] > rolePriority[existing.role]) existing.role = role;
  }
  return [...objects.values()];
}

export async function runOfficialStorageReconciliation(now = new Date()) {
  if (!billingConfig.enabled) return;
  await db
    .insert(resourceManagementState)
    .values({ id: 'official', reconciliationStatus: 'pending' })
    .onConflictDoNothing({ target: resourceManagementState.id });
  const [state] = await db
    .select()
    .from(resourceManagementState)
    .where(eq(resourceManagementState.id, 'official'))
    .limit(1);
  if (state?.reconciliationStatus === 'complete') return;
  const startedAt = state?.reconciliationStartedAt ?? now;
  await db
    .update(resourceManagementState)
    .set({
      reconciliationStatus: 'running',
      reconciliationStartedAt: startedAt,
      reconciliationLastError: null,
      updatedAt: now,
    })
    .where(eq(resourceManagementState.id, 'official'));
  try {
    const [candidate] = await db
      .select({ id: users.id })
      .from(users)
      .leftJoin(resourceStorageAccounts, eq(resourceStorageAccounts.userId, users.id))
      .where(
        and(
          lte(users.createdAt, startedAt),
          or(isNull(resourceStorageAccounts.userId), isNull(resourceStorageAccounts.reconciledAt))
        )
      )
      .orderBy(users.createdAt, users.id)
      .limit(1);
    if (!candidate) {
      await db
        .update(resourceManagementState)
        .set({
          reconciliationStatus: 'complete',
          reconciliationCompletedAt: now,
          reconciliationLastError: null,
          updatedAt: now,
        })
        .where(eq(resourceManagementState.id, 'official'));
      return;
    }
    const rows = await db
      .select({
        id: attachments.id,
        details: attachments.details,
        updatedAt: attachments.updatedAt,
      })
      .from(attachments)
      .where(eq(attachments.userid, candidate.id))
      .orderBy(attachments.id);
    const snapshot = JSON.stringify(rows);
    const objects = new Map<string, ReconciledObject>();
    for (const row of rows) {
      for (const object of attachmentObjects(row.details, candidate.id)) {
        const existing = objects.get(object.key);
        if (existing) existing.references++;
        else objects.set(object.key, object);
      }
    }
    // Deliberately sequential: reconciliation is background work and must not fan out
    // unbounded object-store requests or keep a database lock during network I/O.
    const inspected: Array<ReconciledObject & { actualBytes: bigint }> = [];
    for (const object of objects.values()) {
      const info = await getObjectInfo(object.key);
      if (!info || info.contentLength === null) throw new Error('storage_object_head_failed');
      inspected.push({ ...object, actualBytes: BigInt(info.contentLength) });
    }
    await db.transaction(async (transaction) => {
      const [lockedUser] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, candidate.id))
        .limit(1)
        .for('update');
      if (!lockedUser) return;
      const currentRows = await transaction
        .select({
          id: attachments.id,
          details: attachments.details,
          updatedAt: attachments.updatedAt,
        })
        .from(attachments)
        .where(eq(attachments.userid, candidate.id))
        .orderBy(attachments.id);
      if (JSON.stringify(currentRows) !== snapshot) return;
      await transaction
        .delete(resourceStorageObjects)
        .where(eq(resourceStorageObjects.ownerId, candidate.id));
      if (inspected.length > 0) {
        await transaction.insert(resourceStorageObjects).values(
          inspected.map((object) => ({
            ownerId: candidate.id,
            storageIdentity: 'primary',
            objectKey: object.key,
            role: object.role,
            actualBytes: object.actualBytes,
            billable: object.billable,
            referenceCount: object.references,
          }))
        );
      }
      const usedBytes = inspected.reduce(
        (sum, object) => sum + (object.billable ? object.actualBytes : BigInt(0)),
        BigInt(0)
      );
      await transaction
        .insert(resourceStorageAccounts)
        .values({ userId: candidate.id, usedBytes, reconciledAt: now })
        .onConflictDoUpdate({
          target: resourceStorageAccounts.userId,
          set: { usedBytes, reconciledAt: now, updatedAt: now },
        });
    });
  } catch (error) {
    await db
      .update(resourceManagementState)
      .set({
        reconciliationStatus: 'failed',
        reconciliationLastError:
          error instanceof Error ? error.message.slice(0, 255) : 'reconciliation_failed',
        updatedAt: now,
      })
      .where(eq(resourceManagementState.id, 'official'));
    throw error;
  }
}

export async function isolateReconciliationFailure(
  reconcile: () => Promise<void>,
  onError: (error: unknown) => void
) {
  try {
    await reconcile();
  } catch (error) {
    onError(error);
  }
}

let started = false;

export async function runResourceMaintenance(now = new Date()) {
  await isolateReconciliationFailure(
    () => runOfficialStorageReconciliation(now),
    (error) => {
      // Reconciliation failure must never starve reservation/outbox cleanup.
      // eslint-disable-next-line no-console
      console.error(
        '[managed-storage] reconciliation_failed',
        error instanceof Error ? error.name : 'unknown'
      );
    }
  );
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
          .onConflictDoUpdate({
            target: [resourceCleanupOutbox.storageIdentity, resourceCleanupOutbox.objectKey],
            set: { attempts: 0, nextAttemptAt: now, completedAt: null, lastError: null },
          });
      }
      await transaction
        .update(resourceUploadReservations)
        .set({ status: 'expired', completedAt: now })
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
    const deleted = await r2deletehandler(item.objectKey, { silent: true }).catch(() => false);
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
    await db
      .insert(resourceManagementState)
      .values({ id: 'official', cleanupFuseTripped: true, updatedAt: now })
      .onConflictDoUpdate({
        target: resourceManagementState.id,
        set: { cleanupFuseTripped: true, updatedAt: now },
      });
    // Aggregate only: never log object keys or storage credentials.
    // eslint-disable-next-line no-console
    console.error('[managed-storage] cleanup_backlog_safety_fuse', {
      backlog: Number(backlog?.value ?? 0),
      threshold,
    });
  } else {
    await db
      .insert(resourceManagementState)
      .values({ id: 'official', cleanupFuseTripped: false, updatedAt: now })
      .onConflictDoUpdate({
        target: resourceManagementState.id,
        set: { cleanupFuseTripped: false, updatedAt: now },
      });
  }

  const reservationRetention = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(resourceUploadReservations)
    .where(
      and(
        sql`${resourceUploadReservations.status} <> 'pending'`,
        sql`COALESCE(${resourceUploadReservations.completedAt}, ${resourceUploadReservations.createdAt}) <= ${reservationRetention}`
      )
    );
  const cleanupRetention = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(resourceCleanupOutbox)
    .where(
      and(
        sql`${resourceCleanupOutbox.completedAt} IS NOT NULL`,
        lte(resourceCleanupOutbox.completedAt, cleanupRetention)
      )
    );
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
