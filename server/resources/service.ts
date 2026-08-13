import { and, count, eq, sql } from 'drizzle-orm';
import type { User } from '../drizzle/schema';
import {
  attachments,
  billingGrants,
  resourceStorageAccounts,
  resourceManagementState,
  resourceStorageObjects,
  resourceCleanupOutbox,
  resourceUploadReservations,
  userOpenKeys,
  users,
} from '../drizzle/schema';
import db from '../utils/drizzle';
import { billingConfig } from '../billing/runtimeConfig';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from './errors';

export const OFFICIAL_FREE_STORAGE_BYTES = BigInt(500_000_000);
export const OFFICIAL_FREE_OPENKEY_CREATION_THRESHOLD = 1;

type Management = 'unmanaged' | 'official';
type Source = 'unmanaged' | 'official_free' | 'official_pro' | 'role_exempt';

export type ResourceState = {
  management: Management;
  source: Source;
  storage: {
    enforcement: 'off' | 'observe' | 'enforce';
    usedBytes: string | null;
    reservedBytes: string | null;
    limitBytes: string | null;
    overLimit: boolean | null;
    canUpload: boolean;
  };
  openKey: {
    policy: 'unmanaged' | 'threshold' | 'unlimited';
    creationThreshold: number | null;
    existingCount: number;
    canCreate: boolean;
  };
};

export function reservationCleanupKeys(
  manifest: readonly UploadReservationManifestItem[],
  includeFinalKeys: boolean
): string[] {
  return [
    ...new Set(
      manifest.flatMap((item) =>
        includeFinalKeys ? [item.stagingKey, item.finalKey] : [item.stagingKey]
      )
    ),
  ];
}

export function collectOwnedAttachmentObjectKeys(details: unknown, userId: string): string[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const record = details as Record<string, unknown>;
  const livePhoto =
    record.livePhoto && typeof record.livePhoto === 'object' && !Array.isArray(record.livePhoto)
      ? (record.livePhoto as Record<string, unknown>)
      : undefined;
  const prefix = `users/${userId}/`;
  return [
    ...new Set(
      [
        record.key,
        record.compressKey,
        record.posterKey,
        record.pairedVideoKey,
        record.livePhotoVideoKey,
        livePhoto?.pairedVideoKey,
      ].filter((value): value is string => typeof value === 'string' && value.startsWith(prefix))
    ),
  ];
}

async function enqueueCleanupKeys(
  transaction: any,
  objectKeys: readonly string[],
  nextAttemptAt = new Date()
) {
  for (const objectKey of new Set(objectKeys)) {
    await transaction
      .insert(resourceCleanupOutbox)
      .values({ storageIdentity: 'primary', objectKey, nextAttemptAt })
      .onConflictDoUpdate({
        target: [resourceCleanupOutbox.storageIdentity, resourceCleanupOutbox.objectKey],
        set: { attempts: 0, nextAttemptAt, completedAt: null, lastError: null },
      });
  }
}

export async function assertManagedStorageWritable(executor: Pick<typeof db, 'select'> = db) {
  if (!billingConfig.enabled) return;
  const [state] = await executor
    .select({ cleanupFuseTripped: resourceManagementState.cleanupFuseTripped })
    .from(resourceManagementState)
    .where(eq(resourceManagementState.id, 'official'))
    .limit(1);
  if (state?.cleanupFuseTripped) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.storageBackendUnsupported, 503);
  }
}

export async function cancelPendingUploadReservationsForUser(
  userId: string,
  transactionOverride?: any
) {
  const execute = async (transaction: any) => {
    const pendingReservations = await transaction
      .select()
      .from(resourceUploadReservations)
      .where(
        and(
          eq(resourceUploadReservations.userId, userId),
          eq(resourceUploadReservations.status, 'pending')
        )
      )
      .for('update');
    if (pendingReservations.length === 0) return;
    await enqueueCleanupKeys(
      transaction,
      pendingReservations.flatMap(({ manifest }: { manifest: unknown }) =>
        reservationCleanupKeys(manifest as UploadReservationManifestItem[], true)
      )
    );
    const reservedBytes = pendingReservations.reduce(
      (total: bigint, reservation: { reservedBytes: bigint }) => total + reservation.reservedBytes,
      BigInt(0)
    );
    await transaction
      .update(resourceStorageAccounts)
      .set({
        reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${reservedBytes})`,
        updatedAt: new Date(),
      })
      .where(eq(resourceStorageAccounts.userId, userId));
    await transaction
      .update(resourceUploadReservations)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(
        and(
          eq(resourceUploadReservations.userId, userId),
          eq(resourceUploadReservations.status, 'pending')
        )
      );
  };
  if (transactionOverride) await execute(transactionOverride);
  else await db.transaction(execute);
}

function isRoleExempt(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

function requestedOfficialStorageEnforcement(): 'observe' | 'enforce' {
  const value = process.env.RESOURCE_OFFICIAL_STORAGE_ENFORCEMENT ?? 'observe';
  if (value !== 'observe' && value !== 'enforce') {
    throw new Error('RESOURCE_OFFICIAL_STORAGE_ENFORCEMENT must be observe or enforce');
  }
  return value;
}

export function effectiveOfficialStorageEnforcement(
  requested: 'observe' | 'enforce',
  reconciliationStatus: string | null | undefined
): 'observe' | 'enforce' {
  return requested === 'enforce' && reconciliationStatus === 'complete' ? 'enforce' : 'observe';
}

function grantIsUsable(grant: typeof billingGrants.$inferSelect | null, now: Date): boolean {
  return Boolean(
    grant &&
    (grant.status === 'active' || grant.status === 'grace_period') &&
    grant.leaseExpiresAt &&
    now.getTime() < grant.leaseExpiresAt.getTime() &&
    grant.benefits
  );
}

async function resolveStateWithExecutor(
  executor: Pick<typeof db, 'select'>,
  user: Pick<User, 'id' | 'role'>,
  now: Date
): Promise<ResourceState> {
  if (billingConfig.enabled) {
    const [[grant], [account], [keyCount], [managementState]] = await Promise.all([
      executor.select().from(billingGrants).where(eq(billingGrants.userId, user.id)).limit(1),
      executor
        .select()
        .from(resourceStorageAccounts)
        .where(eq(resourceStorageAccounts.userId, user.id))
        .limit(1),
      executor
        .select({ value: count() })
        .from(userOpenKeys)
        .where(eq(userOpenKeys.userid, user.id)),
      executor
        .select({ reconciliationStatus: resourceManagementState.reconciliationStatus })
        .from(resourceManagementState)
        .where(eq(resourceManagementState.id, 'official'))
        .limit(1),
    ]);
    const existingCount = Number(keyCount?.value ?? 0);
    const enforcement = effectiveOfficialStorageEnforcement(
      requestedOfficialStorageEnforcement(),
      managementState?.reconciliationStatus
    );
    if (isRoleExempt(user.role)) {
      return {
        management: 'official',
        source: 'role_exempt',
        storage: {
          enforcement,
          usedBytes: (account?.usedBytes ?? BigInt(0)).toString(),
          reservedBytes: (account?.reservedBytes ?? BigInt(0)).toString(),
          limitBytes: null,
          overLimit: false,
          canUpload: true,
        },
        openKey: { policy: 'unlimited', creationThreshold: null, existingCount, canCreate: true },
      };
    }
    const pro = grantIsUsable(grant ?? null, now);
    const limit = pro ? BigInt(grant!.benefits!.storage.quotaBytes) : OFFICIAL_FREE_STORAGE_BYTES;
    const used = account?.usedBytes ?? BigInt(0);
    const reserved = account?.reservedBytes ?? BigInt(0);
    const overLimit = used + reserved >= limit;
    return {
      management: 'official',
      source: pro ? 'official_pro' : 'official_free',
      storage: {
        enforcement,
        usedBytes: used.toString(),
        reservedBytes: reserved.toString(),
        limitBytes: limit.toString(),
        overLimit,
        canUpload: enforcement !== 'enforce' || !overLimit,
      },
      openKey: pro
        ? { policy: 'unlimited', creationThreshold: null, existingCount, canCreate: true }
        : {
            policy: 'threshold',
            creationThreshold: OFFICIAL_FREE_OPENKEY_CREATION_THRESHOLD,
            existingCount,
            canCreate: existingCount < OFFICIAL_FREE_OPENKEY_CREATION_THRESHOLD,
          },
    };
  }

  return {
    management: 'unmanaged',
    source: 'unmanaged',
    storage: {
      enforcement: 'off',
      usedBytes: null,
      reservedBytes: null,
      limitBytes: null,
      overLimit: null,
      canUpload: true,
    },
    openKey: {
      policy: 'unmanaged',
      creationThreshold: null,
      existingCount: 0,
      canCreate: true,
    },
  };
}

export function getResourceState(user: Pick<User, 'id' | 'role'>, now = new Date()) {
  return resolveStateWithExecutor(db, user, now);
}

export async function getResourceStateForUserId(userId: string, now = new Date()) {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error('User not found');
  return resolveStateWithExecutor(db, user as User, now);
}

export async function createOpenKeyWithResourcePolicy(
  userId: string,
  permissions: string[] = ['SENDROTE']
) {
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');
    const state = await resolveStateWithExecutor(transaction as any, user as User, new Date());
    if (!state.openKey.canCreate) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.openKeyCreationBlocked, 409);
    }
    const [openKey] = await transaction
      .insert(userOpenKeys)
      .values({ userid: userId, permissions, createdAt: sql`now()`, updatedAt: sql`now()` })
      .returning();
    return openKey;
  });
}

export async function reserveStorageBytes(userId: string, bytes: bigint): Promise<void> {
  if (bytes < BigInt(0)) throw new Error('bytes must be non-negative');
  if (!billingConfig.enabled) return;
  await db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');
    const state = await resolveStateWithExecutor(transaction as any, user as User, new Date());
    if (state.storage.limitBytes !== null) {
      const used = BigInt(state.storage.usedBytes ?? '0');
      const reserved = BigInt(state.storage.reservedBytes ?? '0');
      if (used + reserved + bytes > BigInt(state.storage.limitBytes)) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.storageQuotaExceeded, 413);
      }
    }
    await transaction
      .insert(resourceStorageAccounts)
      .values({ userId, reservedBytes: bytes })
      .onConflictDoUpdate({
        target: resourceStorageAccounts.userId,
        set: {
          reservedBytes: sql`${resourceStorageAccounts.reservedBytes} + ${bytes}`,
          updatedAt: new Date(),
        },
      });
  });
}

export type UploadReservationManifestItem = {
  uuid: string;
  role: 'original' | 'paired_video' | 'compressed' | 'poster';
  stagingKey: string;
  finalKey: string;
  declaredBytes: string | null;
  contentType: string;
  billable: boolean;
};
export type UploadReservationRecord = Omit<
  typeof resourceUploadReservations.$inferSelect,
  'manifest'
> & { manifest: UploadReservationManifestItem[] };

export async function createUploadReservation(params: {
  id: string;
  userId: string;
  manifest: UploadReservationManifestItem[];
  expiresAt: Date;
  credentialExpiresAt?: Date;
}): Promise<boolean> {
  await assertManagedStorageWritable();
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');
    const state = await resolveStateWithExecutor(transaction as any, user as User, new Date());
    if (state.management === 'unmanaged' || state.storage.enforcement === 'off') return false;
    const reservedBytes = params.manifest.reduce(
      (sum, item) => sum + (item.billable ? BigInt(item.declaredBytes ?? '0') : BigInt(0)),
      BigInt(0)
    );
    if (state.storage.enforcement === 'enforce' && state.storage.limitBytes !== null) {
      const projected =
        BigInt(state.storage.usedBytes ?? '0') +
        BigInt(state.storage.reservedBytes ?? '0') +
        reservedBytes;
      if (projected > BigInt(state.storage.limitBytes)) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.storageQuotaExceeded, 413);
      }
    }
    const grant = billingConfig.enabled
      ? ((
          await transaction
            .select({
              revision: billingGrants.revision,
              status: billingGrants.status,
              entitlementExpiresAt: billingGrants.entitlementExpiresAt,
            })
            .from(billingGrants)
            .where(eq(billingGrants.userId, params.userId))
            .limit(1)
        )[0] ?? null)
      : null;
    await transaction.insert(resourceUploadReservations).values({
      id: params.id,
      userId: params.userId,
      grantRevision: grant?.revision ?? null,
      grantProDerived: state.source === 'official_pro',
      grantEntitlementExpiresAt: grant?.entitlementExpiresAt ?? null,
      manifest: params.manifest,
      reservedBytes,
      expiresAt: params.expiresAt,
      credentialExpiresAt: params.credentialExpiresAt ?? null,
    });
    await transaction
      .insert(resourceStorageAccounts)
      .values({ userId: params.userId, reservedBytes })
      .onConflictDoUpdate({
        target: resourceStorageAccounts.userId,
        set: {
          reservedBytes: sql`${resourceStorageAccounts.reservedBytes} + ${reservedBytes}`,
          updatedAt: new Date(),
        },
      });
    return true;
  });
}

export async function appendUploadReservation(params: {
  id: string;
  userId: string;
  item?: UploadReservationManifestItem;
  reserveBytes: bigint;
  expiresAt: Date;
}): Promise<boolean> {
  await assertManagedStorageWritable();
  const outcome = await db.transaction(async (transaction): Promise<boolean | 'expired'> => {
    const now = new Date();
    const [user] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');
    const state = await resolveStateWithExecutor(transaction as any, user as User, now);
    if (state.management === 'unmanaged' || state.storage.enforcement === 'off') return false;
    const [existing] = await transaction
      .select()
      .from(resourceUploadReservations)
      .where(eq(resourceUploadReservations.id, params.id))
      .limit(1)
      .for('update');
    if (existing && (existing.userId !== params.userId || existing.status !== 'pending')) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    if (existing?.expiresAt && existing.expiresAt.getTime() <= now.getTime()) {
      await transaction
        .update(resourceStorageAccounts)
        .set({
          reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${existing.reservedBytes})`,
          updatedAt: now,
        })
        .where(eq(resourceStorageAccounts.userId, params.userId));
      await enqueueCleanupKeys(
        transaction,
        reservationCleanupKeys(existing.manifest as UploadReservationManifestItem[], true)
      );
      await transaction
        .update(resourceUploadReservations)
        .set({ status: 'expired', completedAt: now })
        .where(eq(resourceUploadReservations.id, existing.id));
      return 'expired';
    }
    if (
      existing &&
      billingConfig.enabled &&
      existing.grantProDerived &&
      existing.grantRevision !== null &&
      existing.grantEntitlementExpiresAt !== null &&
      existing.grantEntitlementExpiresAt.getTime() > now.getTime()
    ) {
      const [currentGrant] = await transaction
        .select({ revision: billingGrants.revision, status: billingGrants.status })
        .from(billingGrants)
        .where(eq(billingGrants.userId, params.userId))
        .limit(1);
      if (
        currentGrant &&
        currentGrant.revision > existing.grantRevision &&
        currentGrant.status !== 'active' &&
        currentGrant.status !== 'grace_period'
      ) {
        await transaction
          .update(resourceStorageAccounts)
          .set({
            reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${existing.reservedBytes})`,
            updatedAt: now,
          })
          .where(eq(resourceStorageAccounts.userId, params.userId));
        await enqueueCleanupKeys(
          transaction,
          reservationCleanupKeys(existing.manifest as UploadReservationManifestItem[], true)
        );
        await transaction
          .update(resourceUploadReservations)
          .set({ status: 'cancelled', completedAt: now })
          .where(eq(resourceUploadReservations.id, existing.id));
        return 'expired';
      }
    }
    if (state.storage.enforcement === 'enforce' && state.storage.limitBytes !== null) {
      const projected =
        BigInt(state.storage.usedBytes ?? '0') +
        BigInt(state.storage.reservedBytes ?? '0') +
        params.reserveBytes;
      if (projected > BigInt(state.storage.limitBytes)) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.storageQuotaExceeded, 413);
      }
    }
    if (existing) {
      const manifest = existing.manifest as UploadReservationManifestItem[];
      await transaction
        .update(resourceUploadReservations)
        .set({
          manifest: params.item ? [...manifest, params.item] : manifest,
          reservedBytes: existing.reservedBytes + params.reserveBytes,
        })
        .where(eq(resourceUploadReservations.id, params.id));
    } else {
      const grant = billingConfig.enabled
        ? (
            await transaction
              .select({
                revision: billingGrants.revision,
                entitlementExpiresAt: billingGrants.entitlementExpiresAt,
              })
              .from(billingGrants)
              .where(eq(billingGrants.userId, params.userId))
              .limit(1)
          )[0]
        : null;
      await transaction.insert(resourceUploadReservations).values({
        id: params.id,
        userId: params.userId,
        manifest: params.item ? [params.item] : [],
        reservedBytes: params.reserveBytes,
        expiresAt: params.expiresAt,
        grantRevision: grant?.revision ?? null,
        grantProDerived: state.source === 'official_pro',
        grantEntitlementExpiresAt: grant?.entitlementExpiresAt ?? null,
      });
    }
    await transaction
      .insert(resourceStorageAccounts)
      .values({ userId: params.userId, reservedBytes: params.reserveBytes })
      .onConflictDoUpdate({
        target: resourceStorageAccounts.userId,
        set: {
          reservedBytes: sql`${resourceStorageAccounts.reservedBytes} + ${params.reserveBytes}`,
          updatedAt: new Date(),
        },
      });
    return true;
  });
  if (outcome === 'expired') {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
  }
  return outcome;
}

export async function cancelUploadReservation(userId: string, id: string) {
  await db.transaction(async (transaction) => {
    const [reservation] = await transaction
      .select()
      .from(resourceUploadReservations)
      .where(
        and(eq(resourceUploadReservations.id, id), eq(resourceUploadReservations.userId, userId))
      )
      .limit(1)
      .for('update');
    if (!reservation || reservation.status !== 'pending') return;
    await transaction
      .update(resourceStorageAccounts)
      .set({
        reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${reservation.reservedBytes})`,
        updatedAt: new Date(),
      })
      .where(eq(resourceStorageAccounts.userId, userId));
    await transaction
      .update(resourceUploadReservations)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(resourceUploadReservations.id, id));
    await enqueueCleanupKeys(
      transaction,
      reservationCleanupKeys(reservation.manifest as UploadReservationManifestItem[], true)
    );
  });
}

export async function getPendingUploadReservation(
  userId: string,
  reservationId: string,
  transactionOverride?: any,
  lock = false
): Promise<UploadReservationRecord | null> {
  const executor = transactionOverride ?? db;
  let query = executor
    .select()
    .from(resourceUploadReservations)
    .where(
      and(
        eq(resourceUploadReservations.id, reservationId),
        eq(resourceUploadReservations.userId, userId)
      )
    )
    .limit(1);
  if (lock) query = query.for('update');
  const [reservation] = (await query) as Array<typeof resourceUploadReservations.$inferSelect>;
  if (!reservation) return null;
  if (reservation.status === 'completed') {
    return { ...reservation, manifest: reservation.manifest as UploadReservationManifestItem[] };
  }
  if (reservation.status !== 'pending') return null;
  if (reservation.expiresAt.getTime() <= Date.now()) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
  }
  if (
    billingConfig.enabled &&
    reservation.grantProDerived &&
    reservation.grantRevision !== null &&
    reservation.grantEntitlementExpiresAt !== null &&
    reservation.grantEntitlementExpiresAt.getTime() > Date.now()
  ) {
    const [current] = await executor
      .select({
        revision: billingGrants.revision,
        status: billingGrants.status,
        leaseExpiresAt: billingGrants.leaseExpiresAt,
      })
      .from(billingGrants)
      .where(eq(billingGrants.userId, userId))
      .limit(1);
    const replacedEarly =
      current !== undefined &&
      current.revision > reservation.grantRevision &&
      current.status !== 'active' &&
      current.status !== 'grace_period';
    if (replacedEarly) {
      if (transactionOverride) {
        await transactionOverride
          .update(resourceStorageAccounts)
          .set({
            reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${reservation.reservedBytes})`,
            updatedAt: new Date(),
          })
          .where(eq(resourceStorageAccounts.userId, userId));
        await enqueueCleanupKeys(
          transactionOverride,
          reservationCleanupKeys(reservation.manifest as UploadReservationManifestItem[], true)
        );
        await transactionOverride
          .update(resourceUploadReservations)
          .set({ status: 'cancelled', completedAt: new Date() })
          .where(eq(resourceUploadReservations.id, reservationId));
      } else {
        await cancelUploadReservation(userId, reservationId);
      }
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
    }
  }
  return {
    ...reservation,
    manifest: reservation.manifest as UploadReservationManifestItem[],
  };
}

export async function refreshUploadReservationCredentialExpiry(
  userId: string,
  reservationId: string,
  requestedExpiry: Date
) {
  await assertManagedStorageWritable();
  try {
    return await db.transaction(async (transaction) => {
      const reservation = await getPendingUploadReservation(
        userId,
        reservationId,
        transaction,
        true
      );
      if (!reservation || reservation.status !== 'pending') {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      }
      const credentialExpiresAt = new Date(
        Math.min(requestedExpiry.getTime(), reservation.expiresAt.getTime())
      );
      // S3 signatures have whole-second precision; refuse a refresh rather than
      // rounding a sub-second remainder beyond the absolute reservation deadline.
      if (credentialExpiresAt.getTime() - Date.now() < 1000) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
      }
      await transaction
        .update(resourceUploadReservations)
        .set({ credentialExpiresAt })
        .where(eq(resourceUploadReservations.id, reservation.id));
      return { ...reservation, credentialExpiresAt };
    });
  } catch (error) {
    if (
      error instanceof ResourcePolicyError &&
      error.code === RESOURCE_ERROR_CODES.uploadReservationExpired
    ) {
      await cancelUploadReservation(userId, reservationId);
    }
    throw error;
  }
}

export async function completeUploadReservation(
  params: {
    userId: string;
    reservationId: string;
    result: unknown;
    objects: Array<UploadReservationManifestItem & { actualBytes: bigint }>;
  },
  transactionOverride?: any
): Promise<void> {
  const execute = async (transaction: any) => {
    const [reservation] = await transaction
      .select()
      .from(resourceUploadReservations)
      .where(
        and(
          eq(resourceUploadReservations.id, params.reservationId),
          eq(resourceUploadReservations.userId, params.userId)
        )
      )
      .limit(1)
      .for('update');
    if (!reservation) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    if (reservation.status === 'completed') return;
    if (reservation.status !== 'pending') {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    if (reservation.expiresAt.getTime() <= Date.now()) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired);
    }
    const actualBillable = params.objects.reduce(
      (sum, object) => sum + (object.billable ? object.actualBytes : BigInt(0)),
      BigInt(0)
    );
    if (actualBillable > reservation.reservedBytes) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    for (const object of params.objects) {
      await transaction
        .insert(resourceStorageObjects)
        .values({
          ownerId: params.userId,
          storageIdentity: 'primary',
          objectKey: object.finalKey,
          role: object.role,
          actualBytes: object.actualBytes,
          billable: object.billable,
        })
        .onConflictDoUpdate({
          target: [resourceStorageObjects.storageIdentity, resourceStorageObjects.objectKey],
          set: { actualBytes: object.actualBytes, updatedAt: new Date() },
        });
    }
    await enqueueCleanupKeys(
      transaction,
      params.objects
        .filter((object) => object.stagingKey !== object.finalKey)
        .map((object) => object.stagingKey),
      reservation.credentialExpiresAt ?? new Date()
    );
    const submittedStagingKeys = new Set(params.objects.map((object) => object.stagingKey));
    await enqueueCleanupKeys(
      transaction,
      (reservation.manifest as UploadReservationManifestItem[])
        .filter((object) => !submittedStagingKeys.has(object.stagingKey))
        .map((object) => object.stagingKey),
      reservation.credentialExpiresAt ?? new Date()
    );
    await transaction
      .insert(resourceStorageAccounts)
      .values({ userId: params.userId, usedBytes: actualBillable })
      .onConflictDoUpdate({
        target: resourceStorageAccounts.userId,
        set: {
          usedBytes: sql`${resourceStorageAccounts.usedBytes} + ${actualBillable}`,
          reservedBytes: sql`GREATEST(0, ${resourceStorageAccounts.reservedBytes} - ${reservation.reservedBytes})`,
          updatedAt: new Date(),
        },
      });
    await transaction
      .update(resourceUploadReservations)
      .set({ status: 'completed', result: params.result, completedAt: new Date() })
      .where(eq(resourceUploadReservations.id, reservation.id));
  };
  if (transactionOverride) await execute(transactionOverride);
  else await db.transaction(execute);
}

export function reservationIdFromStagingKey(key: string): string | null {
  return key.match(/\/staging\/([0-9a-f-]{36})\//i)?.[1] ?? null;
}

export async function releaseStorageObjectReferences(
  userId: string,
  objectKeys: string[],
  transactionOverride?: any
): Promise<string[]> {
  const releaseCounts = countObjectKeyReferences(objectKeys);
  if (releaseCounts.size === 0) return [];
  const execute = async (transaction: any) => {
    let released = BigInt(0);
    const trackedKeys: string[] = [];
    for (const [objectKey, releaseCount] of releaseCounts) {
      const [object] = await transaction
        .select()
        .from(resourceStorageObjects)
        .where(
          and(
            eq(resourceStorageObjects.storageIdentity, 'primary'),
            eq(resourceStorageObjects.objectKey, objectKey)
          )
        )
        .limit(1)
        .for('update');
      if (!object || object.ownerId !== userId) continue;
      trackedKeys.push(objectKey);
      if (object.referenceCount > releaseCount) {
        await transaction
          .update(resourceStorageObjects)
          .set({ referenceCount: object.referenceCount - releaseCount, updatedAt: new Date() })
          .where(eq(resourceStorageObjects.id, object.id));
        continue;
      }
      if (object.billable) released += object.actualBytes;
      await transaction
        .delete(resourceStorageObjects)
        .where(eq(resourceStorageObjects.id, object.id));
      await transaction
        .insert(resourceCleanupOutbox)
        .values({ storageIdentity: object.storageIdentity, objectKey })
        .onConflictDoUpdate({
          target: [resourceCleanupOutbox.storageIdentity, resourceCleanupOutbox.objectKey],
          set: { attempts: 0, nextAttemptAt: new Date(), completedAt: null, lastError: null },
        });
    }
    if (released > BigInt(0)) {
      await transaction
        .update(resourceStorageAccounts)
        .set({
          usedBytes: sql`GREATEST(0, ${resourceStorageAccounts.usedBytes} - ${released})`,
          updatedAt: new Date(),
        })
        .where(eq(resourceStorageAccounts.userId, userId));
    }
    return trackedKeys;
  };
  return transactionOverride ? execute(transactionOverride) : db.transaction(execute);
}

export function countObjectKeyReferences(objectKeys: readonly string[]): Map<string, number> {
  const releaseCounts = new Map<string, number>();
  for (const objectKey of objectKeys) {
    releaseCounts.set(objectKey, (releaseCounts.get(objectKey) ?? 0) + 1);
  }
  return releaseCounts;
}

export async function prepareAccountResourceDeletion(userId: string, transactionOverride?: any) {
  const execute = async (transaction: any) => {
    const [lockedUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (!lockedUser) return;
    const objects = (await transaction
      .select({
        storageIdentity: resourceStorageObjects.storageIdentity,
        objectKey: resourceStorageObjects.objectKey,
      })
      .from(resourceStorageObjects)
      .where(eq(resourceStorageObjects.ownerId, userId))
      .for('update')) as Array<{ storageIdentity: string; objectKey: string }>;
    const trackedObjectKeys = new Set(objects.map(({ objectKey }) => objectKey));
    const legacyAttachments = (await transaction
      .select({ details: attachments.details })
      .from(attachments)
      .where(eq(attachments.userid, userId))) as Array<{ details: unknown }>;
    await enqueueCleanupKeys(
      transaction,
      legacyAttachments
        .flatMap(({ details }) => collectOwnedAttachmentObjectKeys(details, userId))
        .filter((objectKey) => !trackedObjectKeys.has(objectKey))
    );
    for (const object of objects) {
      await transaction
        .insert(resourceCleanupOutbox)
        .values(object)
        .onConflictDoUpdate({
          target: [resourceCleanupOutbox.storageIdentity, resourceCleanupOutbox.objectKey],
          set: { attempts: 0, nextAttemptAt: new Date(), completedAt: null, lastError: null },
        });
    }
    await cancelPendingUploadReservationsForUser(userId, transaction);
    await transaction
      .delete(resourceStorageObjects)
      .where(eq(resourceStorageObjects.ownerId, userId));
    await transaction
      .delete(resourceStorageAccounts)
      .where(eq(resourceStorageAccounts.userId, userId));
  };
  if (transactionOverride) await execute(transactionOverride);
  else await db.transaction(execute);
}
