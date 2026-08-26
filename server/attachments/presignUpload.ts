import { randomUUID } from 'crypto';
import { getUploadExtension } from './uploadKeys';
import { getAttachmentUploadPolicy } from './uploadPolicy';
import {
  MAX_FILES,
  getMediaKindFromContentType,
  isImageContentType,
  isVideoContentType,
  validateContentType,
  validateFileSize,
} from '../utils/fileValidation';
import { presignPutUrl } from '../utils/r2';
import type { PresignFileInput } from './types';
import { presignInputIncludesVideo } from './uploadMedia';
import { requireStorageAvailable } from './types';
import attachmentErrors from './errorCodes.json';
import {
  createUploadReservation,
  cancelUploadReservation,
  getResourceStateForUserId,
  refreshUploadReservationCredentialExpiry,
  type UploadReservationManifestItem,
} from '../resources/service';
import { createDerivedUploadProxyUrl } from '../resources/uploadProxy';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';

export type PresignAttachmentDependencies = {
  createDerivedUploadProxyUrl: typeof createDerivedUploadProxyUrl;
  getAttachmentUploadPolicy: typeof getAttachmentUploadPolicy;
  presignPutUrl: typeof presignPutUrl;
  randomUUID: typeof randomUUID;
  requireStorageAvailable: typeof requireStorageAvailable;
  getResourceStateForUserId: typeof getResourceStateForUserId;
  createUploadReservation: typeof createUploadReservation;
};

const defaultDependencies: PresignAttachmentDependencies = {
  createDerivedUploadProxyUrl,
  getAttachmentUploadPolicy,
  presignPutUrl,
  randomUUID,
  requireStorageAvailable,
  getResourceStateForUserId,
  createUploadReservation,
};

const UPLOAD_RESERVATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function validatePresignFile(file: PresignFileInput, maxVideoUploadSizeMB: number) {
  validateContentType(file.contentType);
  if (
    file.compressedContentType !== undefined &&
    file.compressedContentType !== 'image/jpeg' &&
    file.compressedContentType !== 'image/webp'
  ) {
    throw new Error(attachmentErrors.compressedContentTypeInvalid);
  }
  if (file.mediaKind !== 'livePhoto') {
    validateFileSize(file.size, file.contentType, maxVideoUploadSizeMB);
    return;
  }

  if (!isImageContentType(file.contentType)) {
    throw new Error(attachmentErrors.livePhotoOriginalNotImage);
  }
  if (!file.pairedVideo) {
    throw new Error(attachmentErrors.livePhotoPairedVideoRequired);
  }
  validateContentType(file.pairedVideo.contentType);
  if (!isVideoContentType(file.pairedVideo.contentType)) {
    throw new Error(attachmentErrors.livePhotoPairedVideoNotVideo);
  }
  validateFileSize(file.size, file.contentType, maxVideoUploadSizeMB);
  validateFileSize(file.pairedVideo.size, file.pairedVideo.contentType, maxVideoUploadSizeMB);
}

export async function presignAttachmentUploads(
  input: {
    userId: string;
    scopes: string[];
    files: PresignFileInput[];
  },
  dependencyOverrides: Partial<PresignAttachmentDependencies> = {}
) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  dependencies.requireStorageAvailable();
  const uploadPolicy = await dependencies.getAttachmentUploadPolicy(input.userId);
  if (!uploadPolicy.canUploadAttachments) {
    throw new Error(attachmentErrors.capabilityAttachmentUpload);
  }
  if (input.files.length > MAX_FILES) {
    throw new Error(attachmentErrors.fileCountExceeded);
  }

  const hasVideo = presignInputIncludesVideo(input.files);
  if (hasVideo && !input.scopes.includes('video:upload')) {
    throw new Error(attachmentErrors.insufficientVideoUpload);
  }
  if (hasVideo && !uploadPolicy.canUploadVideo) {
    throw new Error(attachmentErrors.capabilityVideoUpload);
  }

  input.files.forEach((file) => validatePresignFile(file, uploadPolicy.maxVideoUploadSizeMB));

  const resourceState = await dependencies.getResourceStateForUserId(input.userId);
  const managed =
    resourceState.management !== 'unmanaged' && resourceState.storage.enforcement !== 'off';
  const reservationId = managed ? dependencies.randomUUID() : null;
  const credentialExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const prepared = input.files.map((file) => {
    const uuid = dependencies.randomUUID();
    const ext = getUploadExtension(file.filename, file.contentType);
    const mediaKind =
      file.mediaKind === 'livePhoto' ? 'livePhoto' : getMediaKindFromContentType(file.contentType);
    const compressedContentType =
      mediaKind === 'image' || mediaKind === 'livePhoto'
        ? (file.compressedContentType ?? (mediaKind === 'livePhoto' ? 'image/jpeg' : 'image/webp'))
        : undefined;
    const finalPrefix = `users/${input.userId}`;
    const stagingPrefix = managed ? `${finalPrefix}/staging/${reservationId}` : finalPrefix;
    const manifest: UploadReservationManifestItem[] = [];
    const originalFinalKey = `${finalPrefix}/uploads/${uuid}${ext}`;
    const originalKey = `${stagingPrefix}/uploads/${uuid}${ext}`;
    manifest.push({
      uuid,
      role: 'original',
      stagingKey: originalKey,
      finalKey: originalFinalKey,
      declaredBytes: String(file.size ?? 0),
      contentType: file.contentType ?? 'application/octet-stream',
      billable: true,
    });
    let compressed:
      | { contentType: 'image/jpeg' | 'image/webp'; key: string; finalKey: string }
      | undefined;
    if (compressedContentType) {
      const compressedExtension = compressedContentType === 'image/jpeg' ? 'jpg' : 'webp';
      compressed = {
        contentType: compressedContentType,
        key: `${stagingPrefix}/compressed/${uuid}.${compressedExtension}`,
        finalKey: `${finalPrefix}/compressed/${uuid}.${compressedExtension}`,
      };
      manifest.push({
        uuid,
        role: 'compressed',
        stagingKey: compressed.key,
        finalKey: compressed.finalKey,
        declaredBytes: null,
        contentType: compressed.contentType,
        billable: false,
      });
    }
    let pairedVideo:
      | { key: string; finalKey: string; contentType: string; size: number }
      | undefined;
    if (mediaKind === 'livePhoto' && file.pairedVideo) {
      const pairedExt = getUploadExtension(file.pairedVideo.filename, file.pairedVideo.contentType);
      pairedVideo = {
        key: `${stagingPrefix}/paired-videos/${uuid}${pairedExt}`,
        finalKey: `${finalPrefix}/paired-videos/${uuid}${pairedExt}`,
        contentType: file.pairedVideo.contentType ?? 'video/quicktime',
        size: file.pairedVideo.size ?? 0,
      };
      manifest.push({
        uuid,
        role: 'paired_video',
        stagingKey: pairedVideo.key,
        finalKey: pairedVideo.finalKey,
        declaredBytes: String(pairedVideo.size),
        contentType: pairedVideo.contentType,
        billable: true,
      });
    }
    let poster: { key: string; finalKey: string } | undefined;
    if (mediaKind === 'video') {
      poster = {
        key: `${stagingPrefix}/posters/${uuid}.jpg`,
        finalKey: `${finalPrefix}/posters/${uuid}.jpg`,
      };
      manifest.push({
        uuid,
        role: 'poster',
        stagingKey: poster.key,
        finalKey: poster.finalKey,
        declaredBytes: null,
        contentType: 'image/jpeg',
        billable: false,
      });
    }
    return { file, uuid, mediaKind, originalKey, manifest, compressed, pairedVideo, poster };
  });

  if (managed && reservationId) {
    await dependencies.createUploadReservation({
      id: reservationId,
      userId: input.userId,
      manifest: prepared.flatMap((item) => item.manifest),
      expiresAt: new Date(Date.now() + UPLOAD_RESERVATION_LIFETIME_MS),
      credentialExpiresAt,
    });
  }

  const items = await Promise.all(
    prepared.map(
      async ({ file, uuid, mediaKind, originalKey, compressed, pairedVideo, poster }) => {
        const original = await dependencies.presignPutUrl(
          originalKey,
          file.contentType || undefined,
          15 * 60,
          managed ? file.size : undefined
        );
        const result: Record<string, any> = {
          uuid,
          ...(managed ? { expiresAt: credentialExpiresAt.toISOString() } : {}),
          original: {
            key: originalKey,
            putUrl: original.putUrl,
            url: original.url,
            contentType: file.contentType,
          },
        };

        if (mediaKind === 'image' || mediaKind === 'livePhoto') {
          if (!compressed) throw new Error('Missing compressed upload manifest');
          const compressedUpload = managed
            ? {
                putUrl: dependencies.createDerivedUploadProxyUrl({
                  reservationId: reservationId!,
                  userId: input.userId,
                  role: 'compressed',
                  key: compressed.key,
                  contentType: compressed.contentType,
                  expiresAt: credentialExpiresAt,
                }),
                url: '',
              }
            : await dependencies.presignPutUrl(compressed.key, compressed.contentType, 15 * 60);
          result.compressed = {
            key: compressed.key,
            putUrl: compressedUpload.putUrl,
            url: compressedUpload.url,
            contentType: compressed.contentType,
          };
        }

        if (mediaKind === 'livePhoto') {
          if (!pairedVideo) throw new Error(attachmentErrors.livePhotoPairedVideoRequired);
          const pairedVideoUpload = await dependencies.presignPutUrl(
            pairedVideo.key,
            pairedVideo.contentType || undefined,
            15 * 60,
            managed ? pairedVideo.size : undefined
          );
          result.pairedVideo = {
            key: pairedVideo.key,
            putUrl: pairedVideoUpload.putUrl,
            url: pairedVideoUpload.url,
            contentType: pairedVideo.contentType,
          };
        }

        if (mediaKind === 'video') {
          if (!poster) throw new Error('Missing poster upload manifest');
          const posterUpload = managed
            ? {
                putUrl: dependencies.createDerivedUploadProxyUrl({
                  reservationId: reservationId!,
                  userId: input.userId,
                  role: 'poster',
                  key: poster.key,
                  contentType: 'image/jpeg',
                  expiresAt: credentialExpiresAt,
                }),
                url: '',
              }
            : await dependencies.presignPutUrl(poster.key, 'image/jpeg', 15 * 60);
          result.poster = {
            key: poster.key,
            putUrl: posterUpload.putUrl,
            url: posterUpload.url,
            contentType: 'image/jpeg',
          };
        }

        return result;
      }
    )
  );

  return {
    items,
    ...(reservationId ? { reservationId, expiresAt: credentialExpiresAt.toISOString() } : {}),
  };
}

export async function refreshAttachmentUploadReservation(userId: string, reservationId: string) {
  const reservation = await refreshUploadReservationCredentialExpiry(
    userId,
    reservationId,
    new Date(Date.now() + 15 * 60 * 1000)
  );
  const expiresAt = reservation.credentialExpiresAt!;
  const remainingMs = expiresAt.getTime() - Date.now();
  if (remainingMs < 1000) {
    await cancelUploadReservation(userId, reservationId);
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
  }
  const expiresIn = Math.floor(remainingMs / 1000);
  const manifest = reservation.manifest as UploadReservationManifestItem[];
  const byUuid = new Map<string, UploadReservationManifestItem[]>();
  for (const item of manifest) {
    const values = byUuid.get(item.uuid) ?? [];
    values.push(item);
    byUuid.set(item.uuid, values);
  }
  const items = await Promise.all(
    [...byUuid.entries()].map(async ([uuid, objects]) => {
      const original = objects.find((item) => item.role === 'original');
      if (!original) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
      const signedOriginal = await presignPutUrl(
        original.stagingKey,
        original.contentType,
        expiresIn,
        original.declaredBytes === null ? undefined : Number(original.declaredBytes)
      );
      const response: Record<string, any> = {
        uuid,
        expiresAt: expiresAt.toISOString(),
        original: {
          key: original.stagingKey,
          putUrl: signedOriginal.putUrl,
          url: signedOriginal.url,
          contentType: original.contentType,
        },
      };
      const derived = (role: 'compressed' | 'poster') => {
        const object = objects.find((item) => item.role === role);
        if (!object) return undefined;
        return {
          key: object.stagingKey,
          putUrl: createDerivedUploadProxyUrl({
            reservationId,
            userId,
            role,
            key: object.stagingKey,
            contentType: object.contentType,
            expiresAt,
          }),
          url: '',
          contentType: object.contentType,
        };
      };
      const compressed = derived('compressed');
      const poster = derived('poster');
      if (compressed) response.compressed = compressed;
      if (poster) response.poster = poster;
      const paired = objects.find((item) => item.role === 'paired_video');
      if (paired) {
        const signed = await presignPutUrl(
          paired.stagingKey,
          paired.contentType,
          expiresIn,
          paired.declaredBytes === null ? undefined : Number(paired.declaredBytes)
        );
        response.pairedVideo = {
          key: paired.stagingKey,
          putUrl: signed.putUrl,
          url: signed.url,
          contentType: paired.contentType,
        };
      }
      return response;
    })
  );
  return { items, reservationId, expiresAt: expiresAt.toISOString() };
}
