import {
  claimUploadReservationForFinalize,
  releaseUploadReservationFinalizeClaim,
  reservationIdFromStagingKey,
  type UploadReservationFinalizeClaim,
  type UploadReservationManifestItem,
} from '../resources/service';
import type { UploadResult } from '../types/main';
import { MAX_FILES } from '../utils/fileValidation';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import { finalizeAttachmentUploads } from './finalizeUpload';
import { normalizeFinalizeAttachmentsFromManifest } from './finalizePayload';
import { finalizeDirectUpload } from './directUploadTransaction';
import { persistAttachmentBatch } from './persistAttachmentBatch';
export { assertAttachmentBindingAllowed } from './persistAttachmentBatch';
import type {
  AttachmentBatchOrderReference,
  FinalizeAttachmentBatchInput,
  FinalizeAttachmentBatchResult,
} from './types';

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

  if (inferredReservationIds.size === 0) {
    return finalizeDirectUpload(
      { userId: params.userId, reservationId, attachments: input.attachments },
      (transaction, uploads) =>
        persistAttachmentBatch(
          { claim: null, input, objects: [], uploads, userId: params.userId },
          transaction
        ),
      (result) => completedBatchResult({ kind: 'completed', result }, normalizedBatchId)
    );
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
    const normalizedInput = {
      ...input,
      attachments: normalizeFinalizeAttachmentsFromManifest(
        input.attachments,
        claim.reservation.manifest
      ),
    };
    const prepared = await prepareUploadsOutsideTransaction(normalizedInput, claim, params.userId);
    const result = await persistAttachmentBatch({
      claim,
      input: normalizedInput,
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
