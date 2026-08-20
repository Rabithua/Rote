import { and, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { attachments, users } from '../drizzle/schema';
import {
  collectOwnedAttachmentObjectKeys,
  enqueueStorageObjectCleanup,
  releaseStorageObjectReferences,
} from '../resources/service';
import db from '../utils/drizzle';

export const UNBOUND_ATTACHMENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const UNBOUND_ATTACHMENT_CLEANUP_BATCH_SIZE = 100;

export type UnboundAttachmentCleanupMode = 'observe' | 'enforce';
export type UnboundAttachmentCleanupResult = {
  mode: UnboundAttachmentCleanupMode;
  scanned: number;
  deleted: number;
  declaredBytes: bigint;
};

type CleanupCandidate = {
  id: string;
  userId: string;
  details: unknown;
};

export function resolveUnboundAttachmentCleanupMode(
  value = process.env.UNBOUND_ATTACHMENT_CLEANUP_MODE
): UnboundAttachmentCleanupMode {
  return value?.toLowerCase() === 'enforce' ? 'enforce' : 'observe';
}

export function attachmentDeclaredBytes(details: unknown): bigint {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return BigInt(0);
  const size = (details as Record<string, unknown>).size;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) return BigInt(0);
  return BigInt(size);
}

function isNotReferencedByProfile() {
  return sql`NOT EXISTS (
    SELECT 1
    FROM ${users}
    WHERE ${users.avatar} = ${attachments.url}
       OR ${users.avatar} = ${attachments.compressUrl}
       OR ${users.cover} = ${attachments.url}
       OR ${users.cover} = ${attachments.compressUrl}
  )`;
}

function eligibleUnboundAttachment(cutoff: Date) {
  return and(
    isNull(attachments.roteid),
    isNotNull(attachments.userid),
    lte(attachments.updatedAt, cutoff),
    isNotReferencedByProfile()
  );
}

async function deleteCandidate(candidate: CleanupCandidate, cutoff: Date): Promise<boolean> {
  return await db.transaction(async (transaction) => {
    await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, candidate.userId))
      .limit(1)
      .for('update');

    const [locked] = (await transaction
      .select({
        id: attachments.id,
        userId: attachments.userid,
        details: attachments.details,
      })
      .from(attachments)
      .where(and(eq(attachments.id, candidate.id), eligibleUnboundAttachment(cutoff)))
      .limit(1)
      .for('update')) as CleanupCandidate[];
    if (!locked || locked.userId !== candidate.userId) return false;

    const objectKeys = collectOwnedAttachmentObjectKeys(locked.details, locked.userId);
    const trackedKeys = new Set(
      await releaseStorageObjectReferences(locked.userId, objectKeys, transaction)
    );
    await enqueueStorageObjectCleanup(
      transaction,
      objectKeys.filter((key) => !trackedKeys.has(key))
    );
    const deleted = await transaction
      .delete(attachments)
      .where(
        and(
          eq(attachments.id, locked.id),
          eq(attachments.userid, locked.userId),
          isNull(attachments.roteid)
        )
      )
      .returning({ id: attachments.id });
    return deleted.length === 1;
  });
}

export async function runUnboundAttachmentCleanup(
  now = new Date(),
  mode = resolveUnboundAttachmentCleanupMode()
): Promise<UnboundAttachmentCleanupResult> {
  const cutoff = new Date(now.getTime() - UNBOUND_ATTACHMENT_RETENTION_MS);
  const candidates = (await db
    .select({
      id: attachments.id,
      userId: attachments.userid,
      details: attachments.details,
    })
    .from(attachments)
    .where(eligibleUnboundAttachment(cutoff))
    .orderBy(attachments.updatedAt, attachments.id)
    .limit(UNBOUND_ATTACHMENT_CLEANUP_BATCH_SIZE)) as CleanupCandidate[];
  const declaredBytes = candidates.reduce(
    (total, candidate) => total + attachmentDeclaredBytes(candidate.details),
    BigInt(0)
  );

  let deleted = 0;
  if (mode === 'enforce') {
    for (const candidate of candidates) {
      if (await deleteCandidate(candidate, cutoff)) deleted += 1;
    }
  }

  if (candidates.length > 0) {
    // Aggregate only: never log attachment, user, or object identifiers.
    // eslint-disable-next-line no-console
    console.info('[managed-storage] unbound_attachment_cleanup', {
      mode,
      scanned: candidates.length,
      deleted,
      declaredBytes: declaredBytes.toString(),
    });
  }
  return { mode, scanned: candidates.length, deleted, declaredBytes };
}
