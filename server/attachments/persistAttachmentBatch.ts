import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { attachments as attachmentsTable, rotes, users } from '../drizzle/schema';
import {
  assertUploadReservationGrantCurrent,
  completeClaimedUploadReservation,
  type UploadReservationFinalizeClaim,
  type UploadReservationManifestItem,
} from '../resources/service';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import type { UploadResult } from '../types/main';
import db from '../utils/drizzle';
import { createRoteChange, upsertAttachmentsByOriginalKey } from '../utils/dbMethods';
import { validateRoteAttachmentDetails } from '../utils/fileValidation';
import type { AttachmentTransaction } from './directUploadTransaction';
import type { FinalizeAttachmentBatchInput, FinalizeAttachmentBatchResult } from './types';

type ActiveFinalizeClaim = Extract<UploadReservationFinalizeClaim, { kind: 'claimed' }>;
type FinalizedManagedObject = UploadReservationManifestItem & { actualBytes: bigint };

export function assertAttachmentBindingAllowed(
  existingNoteId: string | null | undefined,
  targetNoteId: string
) {
  if (existingNoteId && existingNoteId !== targetNoteId) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
}

export async function persistAttachmentBatch(
  params: {
    claim: ActiveFinalizeClaim | null;
    input: FinalizeAttachmentBatchInput;
    objects: FinalizedManagedObject[];
    uploads: UploadResult[];
    userId: string;
  },
  transactionOverride?: AttachmentTransaction
): Promise<FinalizeAttachmentBatchResult> {
  const execute = async (transaction: AttachmentTransaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)
      .for('update');
    if (!user) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    if (params.claim) {
      await assertUploadReservationGrantCurrent(transaction, params.claim.reservation, new Date());
    }

    const [note] = await transaction
      .select({ id: rotes.id })
      .from(rotes)
      .where(and(eq(rotes.id, params.input.noteId), eq(rotes.authorid, params.userId)))
      .limit(1)
      .for('update');
    if (!note) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);

    for (const upload of params.uploads) {
      if (!upload.url) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      }
      const originalKey = (upload.details as { key?: string } | undefined)?.key;
      const matcher = originalKey
        ? or(
            sql`${attachmentsTable.details}->>'key' = ${originalKey}`,
            eq(attachmentsTable.url, upload.url)
          )
        : eq(attachmentsTable.url, upload.url);
      const [existing] = await transaction
        .select({ roteid: attachmentsTable.roteid })
        .from(attachmentsTable)
        .where(and(eq(attachmentsTable.userid, params.userId), matcher))
        .limit(1)
        .for('update');
      assertAttachmentBindingAllowed(existing?.roteid, params.input.noteId);
    }

    const finalized = await upsertAttachmentsByOriginalKey(
      params.userId,
      params.input.noteId,
      params.uploads,
      transaction
    );
    if (finalized.length !== params.input.attachments.length) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }

    const clientIdMap: Record<string, string> = {};
    params.input.attachments.forEach((attachment, index) => {
      const clientId = attachment.clientId!;
      const attachmentId = finalized[index]?.id as string | undefined;
      if (!attachmentId) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      clientIdMap[clientId] = attachmentId;
    });

    const orderedAttachmentIds = params.input.order.map((reference) => {
      if (reference.attachmentId) return reference.attachmentId.toLowerCase();
      const attachmentId = reference.clientId ? clientIdMap[reference.clientId] : undefined;
      if (!attachmentId) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      return attachmentId;
    });
    const uniqueOrderedIds = new Set(orderedAttachmentIds);
    if (uniqueOrderedIds.size !== orderedAttachmentIds.length) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }

    const boundAttachments = await transaction
      .select()
      .from(attachmentsTable)
      .where(
        and(
          eq(attachmentsTable.userid, params.userId),
          eq(attachmentsTable.roteid, params.input.noteId)
        )
      )
      .for('update');
    if (
      boundAttachments.length !== orderedAttachmentIds.length ||
      boundAttachments.some((attachment) => !uniqueOrderedIds.has(attachment.id))
    ) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    validateRoteAttachmentDetails(boundAttachments);

    for (const [sortIndex, attachmentId] of orderedAttachmentIds.entries()) {
      await transaction
        .update(attachmentsTable)
        .set({ sortIndex, updatedAt: new Date() })
        .where(
          and(
            eq(attachmentsTable.id, attachmentId),
            eq(attachmentsTable.userid, params.userId),
            eq(attachmentsTable.roteid, params.input.noteId)
          )
        );
    }
    await transaction
      .update(rotes)
      .set({ updatedAt: new Date() })
      .where(eq(rotes.id, params.input.noteId));

    const orderedAttachments = orderedAttachmentIds.length
      ? await transaction
          .select()
          .from(attachmentsTable)
          .where(inArray(attachmentsTable.id, orderedAttachmentIds))
          .orderBy(asc(attachmentsTable.sortIndex))
      : [];
    const result: FinalizeAttachmentBatchResult = {
      batchId: params.input.batchId,
      attachments: orderedAttachments,
      clientIdMap,
      orderedAttachmentIds,
    };

    await createRoteChange(
      {
        action: 'UPDATE',
        originid: params.input.noteId,
        roteid: params.input.noteId,
        userid: params.userId,
      },
      transaction
    );

    if (params.claim) {
      const completed = await completeClaimedUploadReservation(
        {
          batchId: params.input.batchId,
          leaseToken: params.claim.leaseToken,
          objects: params.objects,
          reservationId: params.claim.reservation.id,
          result,
          userId: params.userId,
        },
        transaction
      );
      return completed as FinalizeAttachmentBatchResult;
    }
    return result;
  };
  return transactionOverride ? execute(transactionOverride) : db.transaction(execute);
}
