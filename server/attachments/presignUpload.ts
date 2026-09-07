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
  cancelUploadReservation: typeof cancelUploadReservation;
};

const defaultDependencies: PresignAttachmentDependencies = {
  createDerivedUploadProxyUrl,
  getAttachmentUploadPolicy,
  presignPutUrl,
  randomUUID,
  requireStorageAvailable,
  getResourceStateForUserId,
  createUploadReservation,
  cancelUploadReservation,
};

const UPLOAD_RESERVATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function signedUploadLifetimeSeconds(expiresAt: Date, now = new Date()): number {
  const seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (seconds < 1) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadReservationExpired, 409);
  }
  return seconds;
}

function validatePresignFile(
  file: PresignFileInput,
  maxVideoUploadSizeMB: number,
  browserDirectUpload: boolean
) {
  validateContentType(file.contentType);
  const compressedContentType = file.compressed?.contentType ?? file.compressedContentType;
  if (
    compressedContentType !== undefined &&
    compressedContentType !== 'image/jpeg' &&
    compressedContentType !== 'image/webp'
  ) {
    throw new Error(attachmentErrors.compressedContentTypeInvalid);
  }
  if (
    file.compressed &&
    file.compressedContentType &&
    file.compressed.contentType !== file.compressedContentType
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const mediaKind =
    file.mediaKind === 'livePhoto' ? 'livePhoto' : getMediaKindFromContentType(file.contentType);
  if (browserDirectUpload && file.compressed) {
    if (mediaKind !== 'image' && mediaKind !== 'livePhoto') {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    validateFileSize(file.compressed.size, file.compressed.contentType, maxVideoUploadSizeMB);
  } else if (browserDirectUpload && file.compressedContentType !== undefined) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  if (browserDirectUpload && file.poster) {
    if (mediaKind !== 'video' || file.poster.contentType !== 'image/jpeg') {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    validateFileSize(file.poster.size, file.poster.contentType, maxVideoUploadSizeMB);
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
    browserDirectUpload?: boolean;
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

  const browserDirectUpload = input.browserDirectUpload === true;
  input.files.forEach((file) =>
    validatePresignFile(file, uploadPolicy.maxVideoUploadSizeMB, browserDirectUpload)
  );

  const resourceState = await dependencies.getResourceStateForUserId(input.userId);
  const managed =
    resourceState.management !== 'unmanaged' && resourceState.storage.enforcement !== 'off';
  if (browserDirectUpload && !managed) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  const reservationId = managed ? dependencies.randomUUID() : null;
  const signingDate = new Date();
  const credentialExpiresAt = new Date(signingDate.getTime() + 15 * 60 * 1000);
  const prepared = input.files.map((file) => {
    const uuid = dependencies.randomUUID();
    const ext = getUploadExtension(file.filename, file.contentType);
    const mediaKind =
      file.mediaKind === 'livePhoto' ? 'livePhoto' : getMediaKindFromContentType(file.contentType);
    const compressedContentType =
      mediaKind === 'image' || mediaKind === 'livePhoto'
        ? browserDirectUpload
          ? file.compressed?.contentType
          : (file.compressedContentType ??
            (mediaKind === 'livePhoto' ? 'image/jpeg' : 'image/webp'))
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
        declaredBytes: browserDirectUpload ? String(file.compressed!.size) : null,
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
    let poster: { key: string; finalKey: string; size: number } | undefined;
    if (mediaKind === 'video' && (!browserDirectUpload || file.poster)) {
      const posterSize = browserDirectUpload ? (file.poster?.size ?? 0) : 0;
      poster = {
        key: `${stagingPrefix}/posters/${uuid}.jpg`,
        finalKey: `${finalPrefix}/posters/${uuid}.jpg`,
        size: posterSize,
      };
      manifest.push({
        uuid,
        role: 'poster',
        stagingKey: poster.key,
        finalKey: poster.finalKey,
        declaredBytes: browserDirectUpload ? String(posterSize) : null,
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

  const signUpload = (key: string, contentType?: string, contentLength?: number) =>
    dependencies.presignPutUrl(
      key,
      contentType,
      signedUploadLifetimeSeconds(credentialExpiresAt, signingDate),
      contentLength,
      signingDate
    );
  let items: Array<Record<string, any>>;
  try {
    items = await Promise.all(
      prepared.map(
        async ({ file, uuid, mediaKind, originalKey, compressed, pairedVideo, poster }) => {
          const original = await signUpload(
            originalKey,
            file.contentType || undefined,
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

          if ((mediaKind === 'image' || mediaKind === 'livePhoto') && compressed) {
            const compressedUpload = browserDirectUpload
              ? await signUpload(compressed.key, compressed.contentType, file.compressed!.size)
              : managed
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
                : await signUpload(compressed.key, compressed.contentType);
            result.compressed = {
              key: compressed.key,
              putUrl: compressedUpload.putUrl,
              url: compressedUpload.url,
              contentType: compressed.contentType,
            };
          }

          if (mediaKind === 'livePhoto') {
            if (!pairedVideo) throw new Error(attachmentErrors.livePhotoPairedVideoRequired);
            const pairedVideoUpload = await signUpload(
              pairedVideo.key,
              pairedVideo.contentType || undefined,
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
            if (!poster) return result;
            const posterUpload = browserDirectUpload
              ? await signUpload(poster.key, 'image/jpeg', poster.size)
              : managed
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
                : await signUpload(poster.key, 'image/jpeg');
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
  } catch (error) {
    if (managed && reservationId) {
      await dependencies.cancelUploadReservation(input.userId, reservationId);
    }
    throw error;
  }

  return {
    items,
    ...(reservationId ? { reservationId, expiresAt: credentialExpiresAt.toISOString() } : {}),
  };
}

export async function refreshAttachmentUploadReservation(userId: string, reservationId: string) {
  const signingDate = new Date();
  const reservation = await refreshUploadReservationCredentialExpiry(
    userId,
    reservationId,
    new Date(signingDate.getTime() + 15 * 60 * 1000)
  );
  const expiresAt = reservation.credentialExpiresAt!;
  try {
    signedUploadLifetimeSeconds(expiresAt, signingDate);
  } catch (error) {
    await cancelUploadReservation(userId, reservationId);
    throw error;
  }
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
        signedUploadLifetimeSeconds(expiresAt, signingDate),
        original.declaredBytes === null ? undefined : Number(original.declaredBytes),
        signingDate
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
      const derived = async (role: 'compressed' | 'poster') => {
        const object = objects.find((item) => item.role === role);
        if (!object) return undefined;
        if (object.declaredBytes !== null) {
          const signed = await presignPutUrl(
            object.stagingKey,
            object.contentType,
            signedUploadLifetimeSeconds(expiresAt, signingDate),
            object.declaredBytes === null ? undefined : Number(object.declaredBytes),
            signingDate
          );
          return {
            key: object.stagingKey,
            putUrl: signed.putUrl,
            url: signed.url,
            contentType: object.contentType,
          };
        }
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
      const compressed = await derived('compressed');
      const poster = await derived('poster');
      if (compressed) response.compressed = compressed;
      if (poster) response.poster = poster;
      const paired = objects.find((item) => item.role === 'paired_video');
      if (paired) {
        const signed = await presignPutUrl(
          paired.stagingKey,
          paired.contentType,
          signedUploadLifetimeSeconds(expiresAt, signingDate),
          paired.declaredBytes === null ? undefined : Number(paired.declaredBytes),
          signingDate
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
