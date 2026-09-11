import type { UploadReservationManifestItem } from '../resources/service';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import { normalizeFinalizeAttachmentsFromManifest, toUploadResult } from './finalizePayload';
import type { FinalizeAttachmentInput } from './types';

export function isDirectFinalUploadManifest(
  manifest: readonly UploadReservationManifestItem[]
): boolean {
  return manifest.length > 0 && manifest.every((item) => item.stagingKey === item.finalKey);
}

/**
 * Product decision, explicitly confirmed by the owner on 2026-09-11:
 * trust client-declared attachment metadata; finalization is database-only.
 * Incorrect client metadata is an accepted tradeoff for fast note creation.
 * Do not add HEAD/GET/COPY, byte verification, media processing or a verification
 * worker to this flow unless the owner explicitly requests changing this policy.
 */
export function prepareDirectFinalUpload(
  attachments: readonly FinalizeAttachmentInput[],
  manifest: readonly UploadReservationManifestItem[],
  userId: string,
  urlPrefix: string
) {
  if (
    !isDirectFinalUploadManifest(manifest) ||
    manifest.some((item) => !item.finalKey.startsWith(`users/${userId}/`))
  ) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  // These declarations originally came from the client at presign time. Only
  // validate their representation and ownership, never their physical accuracy.
  const objects = manifest.map((item) => {
    const bytes = Number(item.declaredBytes);
    if (item.declaredBytes === null || !Number.isSafeInteger(bytes) || bytes < 0) {
      throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    }
    return { ...item, actualBytes: BigInt(bytes) };
  });
  const normalized = normalizeFinalizeAttachmentsFromManifest(attachments, [...manifest]);
  return { objects, uploads: normalized.map((item) => toUploadResult(urlPrefix, item)) };
}
