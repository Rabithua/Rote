import type { UploadResult } from '../types/main';
import {
  extractCompressedUuid,
  extractOriginalUploadUuid,
  extractPairedVideoUuid,
  extractPosterUuid,
} from './uploadKeys';
import { getAttachmentUploadPolicy } from './uploadPolicy';
import { getAttachmentDetailsByRoteId, upsertAttachmentsByOriginalKey } from '../utils/dbMethods';
import {
  MAX_BATCH_SIZE,
  MAX_IMAGE_FILE_SIZE,
  inferAttachmentMediaKind,
  isImageContentType,
  isVideoContentType,
  mergeUniqueRoteAttachmentDetails,
  validateContentType,
  validateFileSize,
  validateRoteAttachmentDetails,
} from '../utils/fileValidation';
import { checkObjectExists, copyObjectIfMatch, getObjectInfo } from '../utils/r2';
import type { FinalizeAttachmentInput } from './types';
import { requireStorageAvailable } from './types';
import attachmentErrors from './errorCodes.json';
import { assertLivePhotoFinalizeBatch } from './livePhotoFinalize';
import { finalizeInputIncludesVideo } from './uploadMedia';
import {
  completeUploadReservation,
  cancelUploadReservation,
  getPendingUploadReservation,
  reservationIdFromStagingKey,
  type UploadReservationManifestItem,
} from '../resources/service';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import db from '../utils/drizzle';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export type FinalizeAttachmentDependencies = {
  checkObjectExists: typeof checkObjectExists;
  getAttachmentDetailsByRoteId: typeof getAttachmentDetailsByRoteId;
  getAttachmentUploadPolicy: typeof getAttachmentUploadPolicy;
  requireStorageAvailable: typeof requireStorageAvailable;
  upsertAttachmentsByOriginalKey: typeof upsertAttachmentsByOriginalKey;
  getObjectInfo: typeof getObjectInfo;
  copyObjectIfMatch: typeof copyObjectIfMatch;
  getPendingUploadReservation: typeof getPendingUploadReservation;
  completeUploadReservation: typeof completeUploadReservation;
};

const defaultDependencies: FinalizeAttachmentDependencies = {
  checkObjectExists,
  getAttachmentDetailsByRoteId,
  getAttachmentUploadPolicy,
  requireStorageAvailable,
  upsertAttachmentsByOriginalKey,
  getObjectInfo,
  copyObjectIfMatch,
  getPendingUploadReservation,
  completeUploadReservation,
};

type FinalizedManagedObject = UploadReservationManifestItem & { actualBytes: bigint };

export function completedLegacyFinalizeResult(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
}

export function assertCompleteRequiredManifest(
  attachments: readonly FinalizeAttachmentInput[],
  manifest: readonly UploadReservationManifestItem[],
  requireDerivedParts = false
) {
  const submitted = new Map<
    string,
    { uuid: string; role: UploadReservationManifestItem['role'] }
  >();
  for (const attachment of attachments) {
    const entries: Array<[string | undefined, UploadReservationManifestItem['role']]> = [
      [attachment.originalKey, 'original'],
      [attachment.compressedKey, 'compressed'],
      [attachment.posterKey, 'poster'],
      [attachment.pairedVideoKey, 'paired_video'],
    ];
    for (const [key, role] of entries) {
      if (!key) continue;
      if (submitted.has(key)) {
        throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      }
      submitted.set(key, { uuid: attachment.uuid, role });
    }
  }
  const expectedByKey = new Map(manifest.map((item) => [item.stagingKey, item]));
  for (const [key, actual] of submitted) {
    const expected = expectedByKey.get(key);
    if (!expected || expected.uuid !== actual.uuid || expected.role !== actual.role) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
  }
  const required = requireDerivedParts
    ? manifest
    : manifest.filter((item) => item.role === 'original' || item.role === 'paired_video');
  if (required.some((item) => !submitted.has(item.stagingKey))) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const originalUuids = manifest
    .filter((item) => item.role === 'original')
    .map((item) => item.uuid);
  if (
    new Set(originalUuids).size !== originalUuids.length ||
    attachments.length !== originalUuids.length ||
    new Set(attachments.map((item) => item.uuid)).size !== attachments.length
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
}

async function promoteManagedObjects(
  userId: string,
  attachments: FinalizeAttachmentInput[],
  dependencies: FinalizeAttachmentDependencies,
  transaction?: any,
  requireDerivedParts = false
): Promise<{ reservationId: string; objects: FinalizedManagedObject[] } | null> {
  const ids = new Set(
    attachments.map((item) => reservationIdFromStagingKey(item.originalKey)).filter(Boolean)
  );
  if (ids.size === 0) return null;
  if (ids.size !== 1 || ids.has(null as any)) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const reservationId = [...ids][0]!;
  const reservation = await dependencies.getPendingUploadReservation(
    userId,
    reservationId,
    transaction,
    Boolean(transaction)
  );
  if (!reservation) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  if (reservation.status === 'completed') return { reservationId, objects: [] };
  assertCompleteRequiredManifest(attachments, reservation.manifest, requireDerivedParts);
  const manifest = new Map(reservation.manifest.map((item) => [item.stagingKey, item]));
  const objects: FinalizedManagedObject[] = [];
  const promote = async (key: string | undefined) => {
    if (!key) return key;
    const expected = manifest.get(key);
    if (!expected) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    const info = await dependencies.getObjectInfo(key);
    if (!info || info.contentLength === null || !info.etag) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    if (
      expected.declaredBytes !== null &&
      BigInt(info.contentLength) !== BigInt(expected.declaredBytes)
    ) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    if (!expected.billable && info.contentLength > MAX_IMAGE_FILE_SIZE) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch, 413);
    }
    if (info.contentType && info.contentType.toLowerCase() !== expected.contentType.toLowerCase()) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    await dependencies.copyObjectIfMatch({
      sourceKey: expected.stagingKey,
      destinationKey: expected.finalKey,
      sourceEtag: info.etag,
    });
    const finalInfo = await dependencies.getObjectInfo(expected.finalKey);
    if (!finalInfo || finalInfo.contentLength !== info.contentLength) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    objects.push({ ...expected, actualBytes: BigInt(info.contentLength) });
    return expected.finalKey;
  };
  for (const item of attachments) {
    item.originalKey = (await promote(item.originalKey))!;
    item.compressedKey = await promote(item.compressedKey);
    item.posterKey = await promote(item.posterKey);
    item.pairedVideoKey = await promote(item.pairedVideoKey);
    const original = objects.find(
      (object) => object.uuid === item.uuid && object.role === 'original'
    );
    if (original) item.size = Number(original.actualBytes);
    const paired = objects.find(
      (object) => object.uuid === item.uuid && object.role === 'paired_video'
    );
    if (paired) item.pairedVideoSize = Number(paired.actualBytes);
  }
  return { reservationId, objects };
}

function assertFinalizeInput(
  attachments: FinalizeAttachmentInput[] | undefined
): asserts attachments is FinalizeAttachmentInput[] {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    throw new Error(attachmentErrors.attachmentsRequired);
  }
  if (attachments.length > MAX_BATCH_SIZE) {
    throw new Error(attachmentErrors.attachmentBatchLimitExceeded);
  }
}

function validateAttachmentPayload(item: FinalizeAttachmentInput, maxVideoUploadSizeMB: number) {
  if (item.mimetype) {
    validateContentType(item.mimetype);
    validateFileSize(item.size, item.mimetype, maxVideoUploadSizeMB);
  }
  if (item.mediaKind === 'livePhoto' || item.pairedVideoKey) {
    if (!isImageContentType(item.mimetype))
      throw new Error(attachmentErrors.livePhotoOriginalNotImage);
    validateContentType(item.pairedVideoMimetype);
    if (!isVideoContentType(item.pairedVideoMimetype))
      throw new Error(attachmentErrors.livePhotoPairedVideoNotVideo);
    validateFileSize(item.pairedVideoSize, item.pairedVideoMimetype, maxVideoUploadSizeMB);
  }
}

async function collectValidAttachments(
  attachments: FinalizeAttachmentInput[],
  objectExists: typeof checkObjectExists,
  strict = false
) {
  const validationErrors: string[] = [];
  const validAttachments: FinalizeAttachmentInput[] = [];
  for (const item of attachments) {
    const mediaKind = inferAttachmentMediaKind({
      mediaKind: item.mediaKind,
      mimetype: item.mimetype,
      compressedKey: item.compressedKey,
      posterKey: item.posterKey,
      pairedVideoKey: item.pairedVideoKey,
      key: item.originalKey,
    });
    const normalizedAttachment = { ...item };
    const originalExists = await objectExists(item.originalKey);
    if (!originalExists) {
      validationErrors.push(
        attachmentErrors.originalFileNotFoundPrefix + item.originalKey + ':' + item.uuid
      );
      continue;
    }

    const originalUuid = extractOriginalUploadUuid(item.originalKey);
    if (!originalUuid || originalUuid !== item.uuid) {
      validationErrors.push(attachmentErrors.uuidMismatchPrefix + item.originalKey);
      continue;
    }
    if (mediaKind === 'video' && normalizedAttachment.compressedKey) {
      validationErrors.push(attachmentErrors.videoCompressedKeyForbiddenPrefix + item.originalKey);
      continue;
    }
    if ((mediaKind === 'image' || mediaKind === 'livePhoto') && normalizedAttachment.posterKey) {
      normalizedAttachment.posterKey = undefined;
    }
    if (
      (mediaKind === 'image' || mediaKind === 'livePhoto') &&
      normalizedAttachment.compressedKey
    ) {
      const compressedExists = await objectExists(normalizedAttachment.compressedKey);
      const compressedUuid = extractCompressedUuid(normalizedAttachment.compressedKey);
      if (!compressedExists || !compressedUuid || originalUuid !== compressedUuid) {
        validationErrors.push(
          attachmentErrors.compressedFileInvalidPrefix + normalizedAttachment.compressedKey
        );
        normalizedAttachment.compressedKey = undefined;
      }
    }
    if (mediaKind === 'livePhoto') {
      if (!normalizedAttachment.pairedVideoKey) {
        validationErrors.push(
          attachmentErrors.livePhotoPairedVideoMissingPrefix + item.originalKey
        );
        continue;
      }
      const pairedVideoExists = await objectExists(normalizedAttachment.pairedVideoKey);
      const pairedVideoUuid = extractPairedVideoUuid(normalizedAttachment.pairedVideoKey);
      if (!pairedVideoExists || !pairedVideoUuid || originalUuid !== pairedVideoUuid) {
        validationErrors.push(
          attachmentErrors.livePhotoPairedVideoInvalidPrefix + normalizedAttachment.pairedVideoKey
        );
        continue;
      }
    } else if (normalizedAttachment.pairedVideoKey) {
      validationErrors.push(attachmentErrors.pairedVideoLivePhotoOnlyPrefix + item.originalKey);
      continue;
    }
    if (mediaKind === 'video' && normalizedAttachment.posterKey) {
      const posterExists = await objectExists(normalizedAttachment.posterKey);
      const posterUuid = extractPosterUuid(normalizedAttachment.posterKey);
      if (!posterExists || !posterUuid || originalUuid !== posterUuid) {
        validationErrors.push(
          attachmentErrors.posterFileInvalidPrefix + normalizedAttachment.posterKey
        );
        normalizedAttachment.posterKey = undefined;
      }
    }
    if (!mediaKind) {
      validationErrors.push(attachmentErrors.attachmentMediaUnsupportedPrefix + item.originalKey);
      continue;
    }
    validAttachments.push(normalizedAttachment);
  }

  if (validAttachments.length === 0 || (strict && validationErrors.length > 0)) {
    const message =
      validationErrors.length === 1
        ? validationErrors[0]
        : attachmentErrors.attachmentValidationErrorsPrefix + validationErrors.join(';');
    throw new Error(message || attachmentErrors.attachmentValidationFailed);
  }
  return validAttachments;
}

function toUploadResult(urlPrefix: string, item: FinalizeAttachmentInput): UploadResult {
  const mediaKind = inferAttachmentMediaKind({
    mediaKind: item.mediaKind,
    mimetype: item.mimetype || null,
    compressedKey: item.compressedKey,
    posterKey: item.posterKey,
    pairedVideoKey: item.pairedVideoKey,
  });
  const pairedVideoUrl =
    mediaKind === 'livePhoto' && item.pairedVideoKey ? urlPrefix + '/' + item.pairedVideoKey : null;
  const details: any = {
    size: item.size || 0,
    mimetype: item.mimetype || null,
    mediaKind,
    mtime: new Date().toISOString(),
    key: item.originalKey,
  };
  if (item.compressedKey) details.compressKey = item.compressedKey;
  if (item.posterKey) details.posterKey = item.posterKey;
  if (pairedVideoUrl && item.pairedVideoKey) {
    details.pairedVideoKey = item.pairedVideoKey;
    details.pairedVideoUrl = pairedVideoUrl;
    details.pairedVideoMimetype = item.pairedVideoMimetype || null;
    details.pairedVideoSize = item.pairedVideoSize || 0;
    if (item.pairedVideoFilename) details.pairedVideoFilename = item.pairedVideoFilename;
  }
  if (item.hash) details.hash = item.hash;

  return {
    url: urlPrefix + '/' + item.originalKey,
    compressUrl:
      (mediaKind === 'image' || mediaKind === 'livePhoto') && item.compressedKey
        ? urlPrefix + '/' + item.compressedKey
        : null,
    posterUrl: mediaKind === 'video' && item.posterKey ? urlPrefix + '/' + item.posterKey : null,
    details,
  };
}

export async function finalizeAttachmentUploads(
  input: {
    userId: string;
    scopes: string[];
    noteId?: string;
    attachments?: FinalizeAttachmentInput[];
  },
  dependencyOverrides: Partial<FinalizeAttachmentDependencies> = {},
  managedTransaction?: any,
  behavior: { manageTransaction?: boolean; strictValidation?: boolean } = {}
): Promise<any[]> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const requestedReservationIds = new Set(
    (input.attachments ?? [])
      .map((item) => reservationIdFromStagingKey(item.originalKey))
      .filter((id): id is string => Boolean(id))
  );
  if (
    behavior.manageTransaction !== false &&
    !managedTransaction &&
    requestedReservationIds.size === 1
  ) {
    const reservationId = [...requestedReservationIds][0]!;
    try {
      return await db.transaction((transaction) =>
        finalizeAttachmentUploads(input, dependencyOverrides, transaction, behavior)
      );
    } catch (error) {
      if (
        error instanceof ResourcePolicyError &&
        error.code === RESOURCE_ERROR_CODES.uploadReservationExpired
      ) {
        await cancelUploadReservation(input.userId, reservationId);
      }
      throw error;
    }
  }
  const storageConfig = dependencies.requireStorageAvailable();
  const uploadPolicy = await dependencies.getAttachmentUploadPolicy(input.userId);
  if (!uploadPolicy.canUploadAttachments)
    throw new Error(attachmentErrors.capabilityAttachmentUpload);

  assertFinalizeInput(input.attachments);
  assertLivePhotoFinalizeBatch(input.attachments);
  const prefix = 'users/' + input.userId + '/';
  const invalid = input.attachments.find(
    (item) =>
      !item.originalKey?.startsWith(prefix) ||
      (item.compressedKey !== undefined && !item.compressedKey.startsWith(prefix)) ||
      (item.posterKey !== undefined && !item.posterKey.startsWith(prefix)) ||
      (item.pairedVideoKey !== undefined && !item.pairedVideoKey.startsWith(prefix))
  );
  if (invalid) throw new Error(attachmentErrors.objectKeyInvalid);
  input.attachments.forEach((item) =>
    validateAttachmentPayload(item, uploadPolicy.maxVideoUploadSizeMB)
  );

  const hasVideo = finalizeInputIncludesVideo(input.attachments);
  if (hasVideo && !input.scopes.includes('video:upload'))
    throw new Error(attachmentErrors.insufficientVideoUpload);
  if (hasVideo && !uploadPolicy.canUploadVideo)
    throw new Error(attachmentErrors.capabilityVideoUpload);

  if (managedTransaction && requestedReservationIds.size === 1) {
    const [lockedUser] = await managedTransaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for('update');
    if (!lockedUser) throw new Error('User not found');
    const reservationId = [...requestedReservationIds][0]!;
    const claimed = await dependencies.getPendingUploadReservation(
      input.userId,
      reservationId,
      managedTransaction,
      true
    );
    if (!claimed) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    if (claimed.status === 'completed') return completedLegacyFinalizeResult(claimed.result);
    assertCompleteRequiredManifest(
      input.attachments,
      claimed.manifest,
      behavior.strictValidation === true
    );
  }

  const validAttachments = await collectValidAttachments(
    input.attachments,
    dependencies.checkObjectExists,
    behavior.strictValidation === true
  );
  const managedPromotion = await promoteManagedObjects(
    input.userId,
    validAttachments,
    dependencies,
    managedTransaction,
    behavior.strictValidation === true
  );
  if (managedPromotion?.objects.length === 0) {
    const completed = await dependencies.getPendingUploadReservation(
      input.userId,
      managedPromotion.reservationId,
      managedTransaction,
      Boolean(managedTransaction)
    );
    if (completed?.status === 'completed') {
      return completedLegacyFinalizeResult(completed.result);
    }
  }
  if (input.noteId) {
    const currentAttachments = await dependencies.getAttachmentDetailsByRoteId(input.noteId);
    const pendingAttachments = validAttachments.map((item) => ({
      details: {
        key: item.originalKey,
        mimetype: item.mimetype || null,
        mediaKind: inferAttachmentMediaKind({
          mediaKind: item.mediaKind,
          mimetype: item.mimetype || null,
          compressedKey: item.compressedKey,
          posterKey: item.posterKey,
          pairedVideoKey: item.pairedVideoKey,
        }),
        compressKey: item.compressedKey,
        posterKey: item.posterKey,
        pairedVideoKey: item.pairedVideoKey,
      },
    }));
    validateRoteAttachmentDetails(
      mergeUniqueRoteAttachmentDetails(currentAttachments, pendingAttachments)
    );
  }

  const uploads = validAttachments.map((item) => toUploadResult(storageConfig.urlPrefix, item));
  const persist = async (transaction?: any) => {
    const finalized = await dependencies.upsertAttachmentsByOriginalKey(
      input.userId,
      input.noteId,
      uploads,
      transaction
    );
    if (managedPromotion) {
      await dependencies.completeUploadReservation(
        {
          userId: input.userId,
          reservationId: managedPromotion.reservationId,
          result: finalized,
          objects: managedPromotion.objects,
        },
        transaction
      );
    }
    return finalized;
  };
  return await persist(managedTransaction);
}
