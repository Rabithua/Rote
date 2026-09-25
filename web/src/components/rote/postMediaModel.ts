import type { AttachmentMedia } from '@/types/main';
import { getAttachmentImageThumbnailSrc, getAttachmentMediaKind } from '@/utils/directUpload';

export type PostMediaItem = {
  attachment: AttachmentMedia;
  type: 'image' | 'gif' | 'video';
  width: number;
  height: number;
  aspectRatio: number;
  thumbnail?: string;
  isLivePhoto: boolean;
};

export function postMediaItem(attachment: AttachmentMedia): PostMediaItem {
  const kind = getAttachmentMediaKind(attachment);
  const width = attachment.details?.width || 1;
  const height = attachment.details?.height || 1;
  const type =
    kind === 'video'
      ? 'video'
      : attachment.details?.mimetype?.toLowerCase() === 'image/gif'
        ? 'gif'
        : 'image';

  return {
    attachment,
    type,
    width,
    height,
    aspectRatio: width / height,
    thumbnail:
      type === 'video'
        ? attachment.posterUrl || undefined
        : getAttachmentImageThumbnailSrc(attachment),
    isLivePhoto: kind === 'livePhoto',
  };
}

export function displayMediaRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio > 0 ? Math.min(1.25, Math.max(0.6, ratio)) : 1;
}
