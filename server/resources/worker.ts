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
import { runUnboundAttachmentCleanup } from '../attachments/unboundCleanup';

export type ReconciledObject = {
  key: string;
  role: UploadReservationManifestItem['role'];
  billable: boolean;
  references: number;
};

type InspectedObject = ReconciledObject & { actualBytes: bigint };

const RECONCILIATION_HEAD_CONCURRENCY = 8;
const RECONCILIATION_USERS_PER_RUN = 100;

export function cleanupRetryDelaySeconds(attempts: number): number {
  return Math.min(3600, 2 ** Math.min(attempts, 10));
}

export async function inspectReconciledObjects(
  objects: readonly ReconciledObject[],
  readObjectInfo: typeof getObjectInfo = getObjectInfo,
  concurrency = RECONCILIATION_HEAD_CONCURRENCY
): Promise<{ inspected: InspectedObject[]; missingCount: number }> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('storage_reconciliation_concurrency_invalid');
  }
  const inspected: Array<InspectedObject | undefined> = new Array(objects.length);
  let cursor = 0;
  let missingCount = 0;
  const inspectNext = async () => {
    while (true) {
      const index = cursor++;
      if (index >= objects.length) return;
      const object = objects[index]!;
      const info = await readObjectInfo(object.key);
      // A legacy attachment can outlive its physical object. It consumes no
      // storage, so omit it from the physical ledger instead of letting one
      // stale row block every user's baseline forever.
      if (!info) {
        missingCount += 1;
        continue;
      }
      if (info.contentLength === null) throw new Error('storage_object_size_unknown');
      inspected[index] = { ...object, actualBytes: BigInt(info.contentLength) };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(objects.length, 1)) }, inspectNext)
  );
  return {
    inspected: inspected.filter((object): object is InspectedObject => object !== undefined),
    missingCount,
  };
}

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
    for (let processed = 0; processed < RECONCILIATION_USERS_PER_RUN; processed += 1) {
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
      // Bound concurrency so large legacy accounts finish before the next
      // maintenance tick without fanning out unbounded object-store requests.
      const { inspected, missingCount } = await inspectReconciledObjects([...objects.values()]);
      const reconciled = await db.transaction(async (transaction) => {
        const [lockedUser] = await transaction
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, candidate.id))
          .limit(1)
          .for('update');
        if (!lockedUser) return true;
        const currentRows = await transaction
          .select({
            id: attachments.id,
            details: attachments.details,
            updatedAt: attachments.updatedAt,
          })
          .from(attachments)
          .where(eq(attachments.userid, candidate.id))
          .orderBy(attachments.id);
        if (JSON.stringify(currentRows) !== snapshot) return false;
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
        return true;
      });
      // A concurrent attachment change invalidates the object snapshot. Retry
      // this user on the next tick rather than repeatedly selecting it here.
      if (!reconciled) return;
      if (missingCount > 0) {
        // Aggregate only: object keys and user identifiers must never reach logs.
        // eslint-disable-next-line no-console
        console.warn('[managed-storage] reconciliation_missing_objects', {
          count: missingCount,
        });
      }
    }
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
let maintenanceInFlight = false;

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
  await isolateReconciliationFailure(
    async () => {
      await runUnboundAttachmentCleanup(now);
    },
    (error) => {
      // eslint-disable-next-line no-console
      console.error(
        '[managed-storage] unbound_attachment_cleanup_failed',
        error instanceof Error ? error.name : 'unknown'
      );
    }
  );
  const expired = await db
    .select()
    .from(resourceUploadReservations)
    .where(
      and(
        or(
          eq(resourceUploadReservations.status, 'pending'),
          eq(resourceUploadReservations.status, 'finalizing')
        ),
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
      if (
        !locked ||
        (locked.status !== 'pending' && locked.status !== 'finalizing') ||
        locked.expiresAt > now
      )
        return;
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
    const delaySeconds = cleanupRetryDelaySeconds(attempts);
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
        sql`COALESCE(${resourceUploadReservations.completedAt}, ${resourceUploadReservations.createdAt}) <= ${reservationRetention.toISOString()}::timestamptz`
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
  started = true;
  const run = () => {
    if (maintenanceInFlight) return;
    maintenanceInFlight = true;
    void runResourceMaintenance()
      .catch((error) => {
        // Never include object keys, upload tokens or credentials in this log.
        // eslint-disable-next-line no-console
        console.error(
          '[managed-storage] maintenance_failed',
          error instanceof Error ? error.name : 'unknown'
        );
      })
      .finally(() => {
        maintenanceInFlight = false;
      });
  };
  run();
  setInterval(run, 60_000).unref();
}
