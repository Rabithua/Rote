import type { UploadReservationManifestItem } from '../resources/service';

export function isDirectFinalUploadManifest(
  manifest: readonly UploadReservationManifestItem[]
): boolean {
  return manifest.length > 0 && manifest.every((item) => item.stagingKey === item.finalKey);
}
