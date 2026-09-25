export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/svg+xml',
];

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES];

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.avif',
  '.svg',
  '.mp4',
  '.webm',
  '.mov',
];

export const MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024;
export const DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB = 300;
export const MAX_FILES = 9;
export const MAX_BATCH_SIZE = 100;

export type MediaKind = 'image' | 'video' | 'livePhoto';

type AttachmentLike = {
  details?: {
    mediaKind?: MediaKind | null;
    mimetype?: string | null;
    contentType?: string | null;
    compressKey?: string | null;
    posterKey?: string | null;
    pairedVideoKey?: string | null;
    livePhotoVideoKey?: string | null;
    key?: string | null;
  } | null;
};

type UploadLike = {
  mediaKind?: MediaKind | null;
  mimetype?: string | null;
  contentType?: string | null;
  compressedKey?: string | null;
  compressKey?: string | null;
  posterKey?: string | null;
  pairedVideoKey?: string | null;
  livePhotoVideoKey?: string | null;
  key?: string | null;
};

const IMAGE_EXTENSION_SET = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.avif',
  '.svg',
]);
const VIDEO_EXTENSION_SET = new Set(['.mp4', '.webm', '.mov']);

export function getMediaKindFromFilename(name?: string | null): MediaKind | null {
  if (!name) return null;

  const normalizedName = name.split('?')[0].toLowerCase();
  const ext = normalizedName.includes('.') ? `.${normalizedName.split('.').pop()}` : '';

  if (IMAGE_EXTENSION_SET.has(ext)) return 'image';
  if (VIDEO_EXTENSION_SET.has(ext)) return 'video';
  return null;
}

export function isImageContentType(contentType?: string | null): boolean {
  return !!contentType && ALLOWED_IMAGE_MIME_TYPES.includes(contentType);
}

export function isVideoContentType(contentType?: string | null): boolean {
  return !!contentType && ALLOWED_VIDEO_MIME_TYPES.includes(contentType);
}

export function getMediaKindFromContentType(contentType?: string | null): MediaKind | null {
  if (isImageContentType(contentType)) return 'image';
  if (isVideoContentType(contentType)) return 'video';
  return null;
}

export function inferAttachmentMediaKind(input?: UploadLike | null): MediaKind | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (
    input.mediaKind === 'image' ||
    input.mediaKind === 'video' ||
    input.mediaKind === 'livePhoto'
  ) {
    return input.mediaKind;
  }

  if (input.pairedVideoKey || input.livePhotoVideoKey) {
    return 'livePhoto';
  }

  const mediaKind = getMediaKindFromContentType(input.mimetype || input.contentType);
  if (mediaKind) {
    return mediaKind;
  }

  const mediaKindFromKey = getMediaKindFromFilename(input.key);
  if (mediaKindFromKey) {
    return mediaKindFromKey;
  }

  if (input.posterKey) {
    return 'video';
  }

  if (input.compressedKey || input.compressKey) {
    return 'image';
  }

  return null;
}

export function getMaxVideoUploadSizeBytes(
  maxVideoUploadSizeMB = DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB
) {
  return Math.max(1, maxVideoUploadSizeMB) * 1024 * 1024;
}

export function validateContentType(contentType?: string): void {
  if (!contentType) {
    throw new Error('Content type is required');
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Content type not allowed: ${contentType}`);
  }
}

export function validateImageFileSize(size: number | undefined | null): void {
  if (size === undefined || size === null) {
    throw new Error('File size (size) is required');
  }
  if (size <= 0) {
    throw new Error('File size must be greater than 0');
  }
  if (size > MAX_IMAGE_FILE_SIZE) {
    throw new Error(`Image file size exceeds limit: ${MAX_IMAGE_FILE_SIZE} bytes`);
  }
}

export function validateVideoFileSize(
  size: number | undefined | null,
  maxVideoUploadSizeMB = DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB
): void {
  if (size === undefined || size === null) {
    throw new Error('File size (size) is required');
  }
  if (size <= 0) {
    throw new Error('File size must be greater than 0');
  }

  const maxVideoSize = getMaxVideoUploadSizeBytes(maxVideoUploadSizeMB);
  if (size > maxVideoSize) {
    throw new Error(`Video file size exceeds limit: ${maxVideoSize} bytes`);
  }
}

export function validateFileSize(
  size: number | undefined | null,
  contentType?: string | null,
  maxVideoUploadSizeMB = DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB
): void {
  const mediaKind = getMediaKindFromContentType(contentType);

  if (mediaKind === 'video') {
    validateVideoFileSize(size, maxVideoUploadSizeMB);
    return;
  }

  validateImageFileSize(size);
}

export function getAttachmentMediaKind(details?: any): MediaKind | null {
  if (!details || typeof details !== 'object') {
    return null;
  }

  return inferAttachmentMediaKind(details);
}

export function getAttachmentStorageKey(item?: AttachmentLike | null): string | null {
  const key = item?.details?.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

export function mergeUniqueRoteAttachmentDetails<T extends AttachmentLike>(
  currentItems: T[],
  pendingItems: T[]
): T[] {
  const existingKeys = new Set(
    currentItems.map((item) => getAttachmentStorageKey(item)).filter((key): key is string => !!key)
  );

  const uniquePendingItems = pendingItems.filter((item) => {
    const key = getAttachmentStorageKey(item);
    return !key || !existingKeys.has(key);
  });

  return [...currentItems, ...uniquePendingItems];
}

export function validateRoteMediaKinds(mediaKinds: MediaKind[]): void {
  if (mediaKinds.length === 0) return;
  if (mediaKinds.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} media attachments can be uploaded to a Rote`);
  }
}

export function validateRoteAttachmentDetails(items: Array<{ details?: any }>): void {
  const mediaKinds = items
    .map((item) => getAttachmentMediaKind(item.details))
    .filter((kind): kind is MediaKind => kind !== null);

  if (mediaKinds.length !== items.length) {
    throw new Error('Unsupported attachment media type');
  }

  validateRoteMediaKinds(mediaKinds);
}
