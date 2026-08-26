import { and, asc, eq, inArray } from 'drizzle-orm';
import { attachments as attachmentsTable, rotes, users } from '../drizzle/schema';
import {
  claimUploadReservationForFinalize,
  completeClaimedUploadReservation,
  releaseUploadReservationFinalizeClaim,
  reservationIdFromStagingKey,
  type UploadReservationFinalizeClaim,
  type UploadReservationManifestItem,
} from '../resources/service';
import type { UploadResult } from '../types/main';
import db from '../utils/drizzle';
import { createRoteChange, upsertAttachmentsByOriginalKey } from '../utils/dbMethods';
import { MAX_FILES, validateRoteAttachmentDetails } from '../utils/fileValidation';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import { finalizeAttachmentUploads } from './finalizeUpload';
import type {
  AttachmentBatchOrderReference,
  FinalizeAttachmentBatchInput,
  FinalizeAttachmentBatchResult,
} from './types';

type FinalizedManagedObject = UploadReservationManifestItem & { actualBytes: bigint };

type ActiveFinalizeClaim = Extract<UploadReservationFinalizeClaim, { kind: 'claimed' }>;

export function assertFinalizeAttachmentBatchInput(input: FinalizeAttachmentBatchInput) {
  if (!input.batchId || !input.noteId) throw new Error('attachment_batch_identity_required');
  if (!Array.isArray(input.attachments) || input.attachments.length === 0) {
    throw new Error('attachments_required');
  }
  if (input.attachments.length > MAX_FILES) throw new Error('file_count_exceeded');
  if (!Array.isArray(input.order) || input.order.length === 0) {
    throw new Error('attachment_batch_order_required');
  }

  const clientIds = input.attachments.map((attachment) => attachment.clientId?.trim() ?? '');
  if (clientIds.some((clientId) => clientId.length === 0)) {
    throw new Error('attachment_batch_client_id_required');
  }
  if (new Set(clientIds).size !== clientIds.length) {
    throw new Error('attachment_batch_client_id_duplicate');
  }

  const orderKeys = input.order.map(orderReferenceKey);
  if (orderKeys.some((key) => key === null)) throw new Error('attachment_batch_order_invalid');
  if (new Set(orderKeys).size !== orderKeys.length) {
    throw new Error('attachment_batch_order_duplicate');
  }
  const orderedClientIds = new Set(
    input.order.flatMap((reference) => (reference.clientId ? [reference.clientId] : []))
  );
  if (
    orderedClientIds.size !== clientIds.length ||
    clientIds.some((clientId) => !orderedClientIds.has(clientId))
  ) {
    throw new Error('attachment_batch_order_incomplete');
  }
}

function orderReferenceKey(reference: AttachmentBatchOrderReference): string | null {
  const attachmentId = reference.attachmentId?.trim();
  const clientId = reference.clientId?.trim();
  if (Boolean(attachmentId) === Boolean(clientId)) return null;
  return attachmentId ? `attachment:${attachmentId}` : `client:${clientId}`;
}

function completedBatchResult(
  claim: Extract<UploadReservationFinalizeClaim, { kind: 'completed' }>,
  batchId: string
): FinalizeAttachmentBatchResult {
  const result = claim.result as Partial<FinalizeAttachmentBatchResult> | null;
  if (
    !result ||
    result.batchId !== batchId ||
    !Array.isArray(result.attachments) ||
    !Array.isArray(result.orderedAttachmentIds) ||
    !result.clientIdMap
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  return result as FinalizeAttachmentBatchResult;
}

async function prepareUploadsOutsideTransaction(
  input: FinalizeAttachmentBatchInput,
  claim: ActiveFinalizeClaim | null,
  userId: string
): Promise<{ objects: FinalizedManagedObject[]; uploads: UploadResult[] }> {
  let uploads: UploadResult[] = [];
  let objects: FinalizedManagedObject[] = [];

  await finalizeAttachmentUploads(
    {
      attachments: input.attachments.map((attachment) => ({ ...attachment })),
      noteId: input.noteId,
      scopes: ['video:upload'],
      userId,
    },
    {
      ...(claim
        ? {
            getPendingUploadReservation: async () => claim.reservation,
          }
        : {}),
      upsertAttachmentsByOriginalKey: async (_userId, _noteId, preparedUploads) => {
        uploads = preparedUploads;
        return preparedUploads.map((upload, index) => ({
          ...upload,
          id: input.attachments[index]?.clientId ?? `prepared-${index}`,
          roteid: input.noteId,
        }));
      },
      completeUploadReservation: async (params) => {
        objects = params.objects;
      },
    },
    undefined,
    { manageTransaction: false, strictValidation: true }
  );

  if (uploads.length !== input.attachments.length) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  return { objects, uploads };
}

async function persistBatch(params: {
  claim: ActiveFinalizeClaim | null;
  input: FinalizeAttachmentBatchInput;
  objects: FinalizedManagedObject[];
  uploads: UploadResult[];
  userId: string;
}): Promise<FinalizeAttachmentBatchResult> {
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)
      .for('update');
    if (!user) throw new Error('User not found');

    const [note] = await transaction
      .select({ id: rotes.id })
      .from(rotes)
      .where(and(eq(rotes.id, params.input.noteId), eq(rotes.authorid, params.userId)))
      .limit(1)
      .for('update');
    if (!note) throw new Error('Note not found or unauthorized');

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
      if (reference.attachmentId) return reference.attachmentId;
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
      throw new Error('attachment_batch_order_does_not_match_note');
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
  });
}

export async function finalizeAttachmentBatch(params: {
  input: FinalizeAttachmentBatchInput;
  scopes: string[];
  userId: string;
}): Promise<FinalizeAttachmentBatchResult> {
  assertFinalizeAttachmentBatchInput(params.input);

  const inferredReservationIds = new Set(
    params.input.attachments
      .map((attachment) => reservationIdFromStagingKey(attachment.originalKey))
      .filter((reservationId): reservationId is string => Boolean(reservationId))
  );
  if (inferredReservationIds.size > 1) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const inferredReservationId = [...inferredReservationIds][0];
  if (params.input.reservationId && params.input.reservationId !== inferredReservationId) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const reservationId = params.input.reservationId ?? inferredReservationId;

  let claim: ActiveFinalizeClaim | null = null;
  if (reservationId) {
    const claimResult = await claimUploadReservationForFinalize({
      batchId: params.input.batchId,
      reservationId,
      userId: params.userId,
    });
    if (claimResult.kind === 'completed') {
      return completedBatchResult(claimResult, params.input.batchId);
    }
    claim = claimResult;
  }

  try {
    const prepared = await prepareUploadsOutsideTransaction(params.input, claim, params.userId);
    const result = await persistBatch({
      claim,
      input: params.input,
      objects: prepared.objects,
      uploads: prepared.uploads,
      userId: params.userId,
    });
    try {
      await createRoteChange({
        action: 'UPDATE',
        originid: params.input.noteId,
        roteid: params.input.noteId,
        userid: params.userId,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to record attachment batch finalize change:', error);
    }
    return result;
  } catch (error) {
    if (claim) {
      await releaseUploadReservationFinalizeClaim({
        batchId: params.input.batchId,
        leaseToken: claim.leaseToken,
        reservationId: claim.reservation.id,
        userId: params.userId,
      });
    }
    throw error;
  }
}
