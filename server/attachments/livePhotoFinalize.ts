import { MAX_FILES } from '../utils/fileValidation';

export const MAX_LIVE_PHOTOS_PER_FINALIZE = MAX_FILES;

type LivePhotoFinalizeItem = {
  mediaKind?: string;
  pairedVideoKey?: string;
};

export function assertLivePhotoFinalizeBatch(items: LivePhotoFinalizeItem[]): void {
  const livePhotoCount = items.filter(
    (item) => item.mediaKind === 'livePhoto' || Boolean(item.pairedVideoKey)
  ).length;
  if (livePhotoCount > MAX_LIVE_PHOTOS_PER_FINALIZE) {
    throw new Error(`Maximum ${MAX_LIVE_PHOTOS_PER_FINALIZE} Live Photos can be finalized at once`);
  }
}
