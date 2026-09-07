import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import type { UploadReservationManifestItem } from '../resources/service';
import type { UploadResult } from '../types/main';
import { inferAttachmentMediaKind } from '../utils/fileValidation';
import type { FinalizeAttachmentInput } from './types';

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

export function toUploadResult(urlPrefix: string, item: FinalizeAttachmentInput): UploadResult {
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
