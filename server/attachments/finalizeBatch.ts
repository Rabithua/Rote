import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { attachments as attachmentsTable, rotes, users } from '../drizzle/schema';
import {
  assertUploadReservationGrantCurrent,
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
import { isDirectFinalUploadManifest, prepareDirectFinalUpload } from './directFinalUpload';
import type {
  AttachmentBatchOrderReference,
  FinalizeAttachmentBatchInput,
  FinalizeAttachmentBatchResult,
} from './types';
import { requireStorageAvailable } from './types';

type FinalizedManagedObject = UploadReservationManifestItem & { actualBytes: bigint };

type ActiveFinalizeClaim = Extract<UploadReservationFinalizeClaim, { kind: 'claimed' }>;

export function assertFinalizeAttachmentBatchInput(
  input: unknown
): asserts input is FinalizeAttachmentBatchInput {
  const invalid = () => new ResourcePolicyError(RESOURCE_ERROR_CODES.attachmentBatchInvalid, 400);
  if (!isRecord(input) || !isNonEmptyString(input.batchId) || !isNonEmptyString(input.noteId)) {
    throw invalid();
  }
  if (input.reservationId !== undefined && !isNonEmptyString(input.reservationId)) {
    throw invalid();
  }
  if (!Array.isArray(input.attachments) || input.attachments.length === 0) {
    throw invalid();
  }
  if (input.attachments.length > MAX_FILES) throw invalid();
  if (input.attachments.some((attachment) => !isBatchAttachmentInput(attachment))) {
    throw invalid();
  }
  if (!Array.isArray(input.order) || input.order.length === 0) {
    throw invalid();
  }
  if (input.order.some((reference) => !isBatchOrderReference(reference))) {
    throw invalid();
  }

  const typedInput = input as unknown as FinalizeAttachmentBatchInput;

  const clientIds = typedInput.attachments.map((attachment) => attachment.clientId?.trim() ?? '');
  if (clientIds.some((clientId) => clientId.length === 0)) {
    throw invalid();
  }
  if (new Set(clientIds).size !== clientIds.length) {
    throw invalid();
  }

  const orderKeys = typedInput.order.map(orderReferenceKey);
  if (orderKeys.some((key) => key === null)) throw invalid();
  if (new Set(orderKeys).size !== orderKeys.length) {
    throw invalid();
  }
  const orderedClientIds = new Set(
    typedInput.order.flatMap((reference) => (reference.clientId ? [reference.clientId] : []))
  );
  if (
    orderedClientIds.size !== clientIds.length ||
    clientIds.some((clientId) => !orderedClientIds.has(clientId))
  ) {
    throw invalid();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOptionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'string';
}

function hasOptionalNumber(record: Record<string, unknown>, key: string): boolean {
  return (
    record[key] === undefined || (typeof record[key] === 'number' && Number.isFinite(record[key]))
  );
}

function isBatchAttachmentInput(
  value: unknown
): value is FinalizeAttachmentBatchInput['attachments'][number] {
  if (!isRecord(value)) return false;
  if (
    !isNonEmptyString(value.clientId) ||
    !isNonEmptyString(value.uuid) ||
    !isNonEmptyString(value.originalKey)
  ) {
    return false;
  }
  const optionalStrings = [
    'compressedKey',
    'posterKey',
    'pairedVideoKey',
    'pairedVideoMimetype',
    'pairedVideoFilename',
    'mimetype',
    'hash',
    'noteId',
  ];
  if (optionalStrings.some((key) => !hasOptionalString(value, key))) return false;
  if (!hasOptionalNumber(value, 'size') || !hasOptionalNumber(value, 'pairedVideoSize')) {
    return false;
  }
  return (
    value.mediaKind === undefined ||
    value.mediaKind === 'image' ||
    value.mediaKind === 'video' ||
    value.mediaKind === 'livePhoto'
  );
}

function isBatchOrderReference(value: unknown): value is AttachmentBatchOrderReference {
  if (!isRecord(value)) return false;
  const attachmentId = value.attachmentId;
  const clientId = value.clientId;
  return (
    (isNonEmptyString(attachmentId) && clientId === undefined) ||
    (attachmentId === undefined && isNonEmptyString(clientId))
  );
}

function orderReferenceKey(reference: AttachmentBatchOrderReference): string | null {
  const attachmentId = reference.attachmentId?.trim();
  const clientId = reference.clientId?.trim();
  if (Boolean(attachmentId) === Boolean(clientId)) return null;
  return attachmentId ? `attachment:${attachmentId}` : `client:${clientId}`;
}

export function assertAttachmentBindingAllowed(
  existingNoteId: string | null | undefined,
  targetNoteId: string
) {
  if (existingNoteId && existingNoteId !== targetNoteId) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
}

function completedBatchResult(
  claim: Extract<UploadReservationFinalizeClaim, { kind: 'completed' }>,
  batchId: string
): FinalizeAttachmentBatchResult {
  const result = claim.result as Partial<FinalizeAttachmentBatchResult> | null;
  if (
    !result ||
    typeof result.batchId !== 'string' ||
    result.batchId.toLowerCase() !== batchId ||
    !Array.isArray(result.attachments) ||
    !Array.isArray(result.orderedAttachmentIds) ||
    !result.clientIdMap
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  return { ...(result as FinalizeAttachmentBatchResult), batchId };
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
  });
}

export async function finalizeAttachmentBatch(params: {
  input: FinalizeAttachmentBatchInput;
  scopes: string[];
  userId: string;
}): Promise<FinalizeAttachmentBatchResult> {
  assertFinalizeAttachmentBatchInput(params.input);

  const normalizedBatchId = params.input.batchId.toLowerCase();
  const normalizedReservationId = params.input.reservationId?.toLowerCase();
  const input: FinalizeAttachmentBatchInput = {
    ...params.input,
    batchId: normalizedBatchId,
    reservationId: normalizedReservationId,
  };

  const inferredReservationIds = new Set(
    input.attachments
      .map((attachment) => reservationIdFromStagingKey(attachment.originalKey))
      .map((reservationId) => reservationId?.toLowerCase() ?? null)
      .filter((reservationId): reservationId is string => Boolean(reservationId))
  );
  if (inferredReservationIds.size > 1) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const inferredReservationId = [...inferredReservationIds][0];
  if (
    normalizedReservationId &&
    inferredReservationId &&
    normalizedReservationId !== inferredReservationId
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const reservationId = normalizedReservationId ?? inferredReservationId;
  if (!reservationId) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }

  const claimResult = await claimUploadReservationForFinalize({
    batchId: normalizedBatchId,
    reservationId,
    userId: params.userId,
  });
  if (claimResult.kind === 'completed') {
    return completedBatchResult(claimResult, normalizedBatchId);
  }
  const claim: ActiveFinalizeClaim = claimResult;

  try {
    const prepared = isDirectFinalUploadManifest(claim.reservation.manifest)
      ? prepareDirectFinalUpload(
          input,
          claim.reservation.manifest,
          params.userId,
          requireStorageAvailable().urlPrefix
        )
      : await prepareUploadsOutsideTransaction(input, claim, params.userId);
    const result = await persistBatch({
      claim,
      input,
      objects: prepared.objects,
      uploads: prepared.uploads,
      userId: params.userId,
    });
    return result;
  } catch (error) {
    await releaseUploadReservationFinalizeClaim({
      batchId: normalizedBatchId,
      leaseToken: claim.leaseToken,
      reservationId: claim.reservation.id,
      userId: params.userId,
    });
    throw error;
  }
}
