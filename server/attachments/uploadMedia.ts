import { inferAttachmentMediaKind, isVideoContentType } from '../utils/fileValidation';
import type { FinalizeAttachmentInput, PresignFileInput } from './types';

export function presignInputIncludesVideo(files: PresignFileInput[]): boolean {
  return files.some(
    (file) => isVideoContentType(file.contentType) || file.mediaKind === 'livePhoto'
  );
}

export function finalizeInputIncludesVideo(attachments: FinalizeAttachmentInput[]): boolean {
  return attachments.some(
    (attachment) =>
      inferAttachmentMediaKind({
        mediaKind: attachment.mediaKind,
        mimetype: attachment.mimetype,
        compressedKey: attachment.compressedKey,
        posterKey: attachment.posterKey,
        pairedVideoKey: attachment.pairedVideoKey,
        key: attachment.originalKey,
      }) === 'video' ||
      attachment.mediaKind === 'livePhoto' ||
      Boolean(attachment.pairedVideoKey)
  );
}

export function isHeicLikeUpload(attachment: FinalizeAttachmentInput): boolean {
  const mimetype = attachment.mimetype?.toLowerCase();
  return (
    mimetype === 'image/heic' ||
    mimetype === 'image/heif' ||
    /\.(?:heic|heif)$/i.test(attachment.originalKey)
  );
}
