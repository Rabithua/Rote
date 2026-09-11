import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import { completeUploadReservation, getPendingUploadReservation } from '../resources/service';
import type { UploadResult } from '../types/main';
import db from '../utils/drizzle';
import { prepareDirectFinalUpload } from './directFinalUpload';
import { requireStorageAvailable, type FinalizeAttachmentInput } from './types';

export type AttachmentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Owner-locked fast upload policy (2026-09-11): one database transaction,
 * no storage requests or finalize lease. Change only at the owner's explicit request.
 * A row lock serializes retries; the saved result prevents duplicate attachment charges.
 */
export async function finalizeDirectUpload<T>(
  input: { userId: string; reservationId: string; attachments: FinalizeAttachmentInput[] },
  persist: (transaction: AttachmentTransaction, uploads: UploadResult[]) => Promise<T>,
  restore: (result: unknown) => T
): Promise<T> {
  const { urlPrefix } = requireStorageAvailable();
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for('update');
    if (!user) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    const reservation = await getPendingUploadReservation(
      input.userId,
      input.reservationId,
      transaction,
      true
    );
    if (!reservation) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    if (reservation.status === 'completed') return restore(reservation.result);
    const prepared = prepareDirectFinalUpload(
      input.attachments,
      reservation.manifest,
      input.userId,
      urlPrefix
    );
    const result = await persist(transaction, prepared.uploads);
    await completeUploadReservation({ ...input, objects: prepared.objects, result }, transaction);
    return result;
  });
}
