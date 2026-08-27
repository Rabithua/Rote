import type { UploadResult } from '../types/main';
import { inferAttachmentMediaKind } from '../utils/fileValidation';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import type { UploadReservationManifestItem } from '../resources/service';
import type { FinalizeAttachmentBatchInput, FinalizeAttachmentInput } from './types';
import { assertCompleteRequiredManifest, toUploadResult } from './finalizeUpload';

export type PreparedDirectFinalUpload = {
  objects: Array<UploadReservationManifestItem & { actualBytes: bigint }>;
  uploads: UploadResult[];
};

export function isDirectFinalUploadManifest(
  manifest: readonly UploadReservationManifestItem[]
): boolean {
  return manifest.length > 0 && manifest.every((item) => item.stagingKey === item.finalKey);
}

function invalid(): never {
  throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
}

function normalizedContentType(value: string | undefined): string | null {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? null;
}

function exactDeclaredBytes(
  submitted: number | undefined,
  manifestItem: UploadReservationManifestItem
): number {
  if (manifestItem.declaredBytes === null) invalid();
  const expected = Number(manifestItem.declaredBytes);
  if (!Number.isSafeInteger(expected) || expected <= 0 || submitted !== expected) invalid();
  return expected;
}

export function prepareDirectFinalUpload(
  input: FinalizeAttachmentBatchInput,
  manifest: readonly UploadReservationManifestItem[],
  userId: string,
  urlPrefix: string
): PreparedDirectFinalUpload {
  if (!isDirectFinalUploadManifest(manifest)) invalid();
  assertCompleteRequiredManifest(input.attachments, manifest, true);

  const manifestByUuid = new Map<string, UploadReservationManifestItem[]>();
  for (const item of manifest) {
    const expectedPrefix = `users/${userId}/attachments/${item.uuid}/`;
    if (!item.finalKey.startsWith(expectedPrefix) || item.declaredBytes === null) invalid();
    const entries = manifestByUuid.get(item.uuid) ?? [];
    entries.push(item);
    manifestByUuid.set(item.uuid, entries);
  }

  const uploads = input.attachments.map((attachment): UploadResult => {
    const objects = manifestByUuid.get(attachment.uuid) ?? invalid();
    const original = objects.find((item) => item.role === 'original') ?? invalid();
    const paired = objects.find((item) => item.role === 'paired_video');
    const poster = objects.find((item) => item.role === 'poster');
    const compressed = objects.find((item) => item.role === 'compressed');
    if (compressed) invalid();

    const size = exactDeclaredBytes(attachment.size, original);
    if (
      normalizedContentType(attachment.mimetype) !== normalizedContentType(original.contentType)
    ) {
      invalid();
    }
    if (paired) {
      exactDeclaredBytes(attachment.pairedVideoSize, paired);
      if (
        normalizedContentType(attachment.pairedVideoMimetype) !==
        normalizedContentType(paired.contentType)
      ) {
        invalid();
      }
    }

    const mediaKind = paired
      ? 'livePhoto'
      : poster
        ? 'video'
        : inferAttachmentMediaKind({
            mediaKind: attachment.mediaKind,
            mimetype: original.contentType,
            key: original.finalKey,
          });
    if (!mediaKind || (attachment.mediaKind && attachment.mediaKind !== mediaKind)) invalid();

    const normalized: FinalizeAttachmentInput = {
      ...attachment,
      compressedKey: undefined,
      mediaKind,
      mimetype: original.contentType,
      originalKey: original.finalKey,
      pairedVideoKey: paired?.finalKey,
      pairedVideoMimetype: paired?.contentType,
      pairedVideoSize: paired ? Number(paired.declaredBytes) : undefined,
      posterKey: poster?.finalKey,
      size,
    };
    return toUploadResult(urlPrefix, normalized);
  });

  return {
    objects: manifest.map((item) => ({
      ...item,
      actualBytes: BigInt(item.declaredBytes!),
    })),
    uploads,
  };
}
