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

export type PresignAttachmentDependencies = {
  getAttachmentUploadPolicy: typeof getAttachmentUploadPolicy;
  presignPutUrl: typeof presignPutUrl;
  randomUUID: typeof randomUUID;
  requireStorageAvailable: typeof requireStorageAvailable;
};

const defaultDependencies: PresignAttachmentDependencies = {
  getAttachmentUploadPolicy,
  presignPutUrl,
  randomUUID,
  requireStorageAvailable,
};

function validatePresignFile(file: PresignFileInput, maxVideoUploadSizeMB: number) {
  validateContentType(file.contentType);
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

  const items = await Promise.all(
    input.files.map(async (file) => {
      const uuid = dependencies.randomUUID();
      const ext = getUploadExtension(file.filename, file.contentType);
      const originalKey = 'users/' + input.userId + '/uploads/' + uuid + ext;
      const mediaKind =
        file.mediaKind === 'livePhoto'
          ? 'livePhoto'
          : getMediaKindFromContentType(file.contentType);
      const original = await dependencies.presignPutUrl(
        originalKey,
        file.contentType || undefined,
        15 * 60
      );
      const result: Record<string, any> = {
        uuid,
        original: {
          key: originalKey,
          putUrl: original.putUrl,
          url: original.url,
          contentType: file.contentType,
        },
      };

      // Live Photo stills are generated server-side during finalize. Do not ask
      // clients to encode WebP, because iOS cannot reliably produce it.
      if (mediaKind === 'image') {
        const compressedKey = 'users/' + input.userId + '/compressed/' + uuid + '.webp';
        const compressed = await dependencies.presignPutUrl(compressedKey, 'image/webp', 15 * 60);
        result.compressed = {
          key: compressedKey,
          putUrl: compressed.putUrl,
          url: compressed.url,
          contentType: 'image/webp',
        };
      }

      if (mediaKind === 'livePhoto') {
        const pairedVideo = file.pairedVideo;
        if (!pairedVideo) throw new Error(attachmentErrors.livePhotoPairedVideoRequired);
        const pairedVideoExt = getUploadExtension(pairedVideo.filename, pairedVideo.contentType);
        const pairedVideoKey = 'users/' + input.userId + '/paired-videos/' + uuid + pairedVideoExt;
        const pairedVideoUpload = await dependencies.presignPutUrl(
          pairedVideoKey,
          pairedVideo.contentType || undefined,
          15 * 60
        );
        result.pairedVideo = {
          key: pairedVideoKey,
          putUrl: pairedVideoUpload.putUrl,
          url: pairedVideoUpload.url,
          contentType: pairedVideo.contentType,
        };
      }

      if (mediaKind === 'video') {
        const posterKey = 'users/' + input.userId + '/posters/' + uuid + '.jpg';
        const poster = await dependencies.presignPutUrl(posterKey, 'image/jpeg', 15 * 60);
        result.poster = {
          key: posterKey,
          putUrl: poster.putUrl,
          url: poster.url,
          contentType: 'image/jpeg',
        };
      }

      return result;
    })
  );

  return { items };
}
