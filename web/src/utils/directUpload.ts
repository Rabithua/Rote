import type { Attachment } from '@/types/main';
import axios, { type AxiosProgressEvent } from 'axios';
import i18n from 'i18next';
import { post } from './api';

const RESOURCE_UPLOAD_ERROR_TRANSLATIONS = {
  resource_storage_quota_exceeded: 'pages.profile.resources.errors.storageQuotaExceeded',
  resource_upload_reservation_expired: 'pages.profile.resources.errors.reservationExpired',
  resource_upload_manifest_mismatch: 'pages.profile.resources.errors.manifestMismatch',
  resource_storage_reconciliation_required: 'pages.profile.resources.errors.reconciliationRequired',
  resource_storage_backend_unsupported: 'pages.profile.resources.errors.backendUnsupported',
} as const;

type ResourceUploadErrorCode = keyof typeof RESOURCE_UPLOAD_ERROR_TRANSLATIONS;

function errorCandidates(error: unknown): unknown[] {
  const value = error as any;
  return [
    value?.code,
    value?.message,
    value?.response?.data?.code,
    value?.response?.data?.message,
    value?.response?.data?.error,
  ];
}

export function getResourceUploadErrorCode(error: unknown): ResourceUploadErrorCode | null {
  for (const candidate of errorCandidates(error)) {
    if (
      typeof candidate === 'string' &&
      Object.hasOwn(RESOURCE_UPLOAD_ERROR_TRANSLATIONS, candidate)
    ) {
      return candidate as ResourceUploadErrorCode;
    }
  }
  return null;
}

export function isResourceUploadPolicyError(error: unknown): boolean {
  return getResourceUploadErrorCode(error) !== null;
}

export type MediaKind = 'image' | 'video' | 'livePhoto';
export type PresignFile = {
  filename?: string;
  contentType?: string;
  size?: number;
  mediaKind?: MediaKind;
  pairedVideo?: { filename?: string; contentType?: string; size?: number };
};

export type PresignItem = {
  uuid: string;
  original: { key: string; putUrl: string; url: string; contentType?: string };
  compressed?: {
    key: string;
    putUrl: string;
    url: string;
    contentType: 'image/jpeg' | 'image/webp';
  };
  poster?: { key: string; putUrl: string; url: string; contentType: 'image/jpeg' };
  pairedVideo?: { key: string; putUrl: string; url: string; contentType?: string };
};

export interface PresignResponse {
  code: number;
  message?: string;
  data: {
    items: PresignItem[];
  };
}

export async function presign(files: PresignFile[]) {
  const res = (await post('/attachments/presign', { files })) as PresignResponse;
  if (res.code !== 0) throw new Error(res.message || 'presign failed');
  return res.data.items as PresignItem[];
}

export type UploadProgressCallback = (_progress: number) => void;

export async function uploadToSignedUrl(
  putUrl: string,
  blob: Blob,
  onProgress?: UploadProgressCallback
) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Empty upload payload');
  }

  let resp;
  try {
    resp = await axios.put(putUrl, blob, {
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
      },
      transformRequest: [(data) => data as Blob],
      transitional: { clarifyTimeoutError: true },
      validateStatus: () => true,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (!onProgress) return;
        const total = progressEvent.total ?? blob.size;
        if (!total) return;
        const progress = Math.min(
          100,
          Math.max(0, Math.round((progressEvent.loaded / total) * 100))
        );
        onProgress(progress);
      },
    });
  } catch (err: any) {
    // axios throws on network-level failures (CORS blocked, DNS, offline, etc.)
    if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      throw new Error(
        `CORS/Network Error: unable to PUT to storage. ` +
          `Please check S3/R2 bucket CORS configuration allows the current origin. ` +
          `(${err.message})`
      );
    }
    if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
      throw new Error(`Upload timeout: ${err.message}`);
    }
    throw err;
  }

  if (resp.status < 200 || resp.status >= 300) {
    const reqId = resp.headers?.['x-amz-request-id'] || resp.headers?.['cf-ray'] || '';
    const bodyText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data || {});
    throw new Error(`Upload failed: HTTP ${resp.status} ${reqId} ${bodyText}`.trim());
  }

  onProgress?.(100);
}

/**
 * Extract a human-readable error message from upload errors for debugging.
 * Handles CORS, network, timeout, HTTP status, and business-level errors.
 */
export function getUploadErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  const resourceCode = getResourceUploadErrorCode(error);
  if (resourceCode) {
    return i18n.t(RESOURCE_UPLOAD_ERROR_TRANSLATIONS[resourceCode]);
  }

  const err = error as any;

  // Already formatted by uploadToSignedUrl
  if (err.message && typeof err.message === 'string') {
    // CORS / Network
    if (err.message.startsWith('CORS/Network Error')) return err.message;
    if (err.message.startsWith('Upload timeout')) return err.message;
    if (err.message.startsWith('Upload failed: HTTP')) return err.message;
  }

  // axios error with response (HTTP-level error from presign/finalize API)
  if (err.response) {
    const status = err.response.status;
    const serverMsg =
      err.response.data?.message || err.response.data?.error || err.response.statusText || '';
    if (serverMsg) return `HTTP ${status}: ${serverMsg}`;
    return `HTTP ${status}`;
  }

  // axios error codes
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return `CORS/Network Error: ${err.message}. Check browser console for details.`;
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return `Request Timeout: ${err.message}`;
  }

  // Generic Error with message
  if (err.message && typeof err.message === 'string') {
    return err.message;
  }

  // Fallback
  return String(error);
}

export type FinalizeAttachment = {
  uuid: string;
  originalKey: string;
  compressedKey?: string;
  posterKey?: string;
  pairedVideoKey?: string;
  pairedVideoSize?: number;
  pairedVideoMimetype?: string;
  pairedVideoFilename?: string;
  size?: number;
  mimetype?: string;
  mediaKind?: MediaKind;
  hash?: string;
};

export async function finalize(attachments: FinalizeAttachment[], noteId?: string) {
  const res = (await post('/attachments/finalize', { attachments, noteId })) as Record<string, any>;
  if (res.code !== 0) throw new Error(res.message || 'finalize failed');
  return (res.data as any[]) || [];
}

export function getAttachmentMediaKind(attachment: File | Attachment): MediaKind | null {
  const mimetype = attachment instanceof File ? attachment.type : attachment.details?.mimetype;
  const mediaKind = attachment instanceof File ? undefined : attachment.details?.mediaKind;
  const pairedVideoKey =
    attachment instanceof File ? undefined : attachment.details?.pairedVideoKey;

  if (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'livePhoto') {
    return mediaKind;
  }
  if (pairedVideoKey) return 'livePhoto';
  if (mimetype?.startsWith('image/')) return 'image';
  if (mimetype?.startsWith('video/')) return 'video';
  return null;
}

export function isHeicLikeAttachment(attachment: File | Attachment) {
  const mimetype =
    (attachment instanceof File ? attachment.type : attachment.details?.mimetype)?.toLowerCase() ||
    '';
  if (mimetype === 'image/heic' || mimetype === 'image/heif') {
    return true;
  }

  const candidateNames =
    attachment instanceof File
      ? [attachment.name]
      : [
          attachment.details?.originalname,
          attachment.details?.key,
          attachment.url,
          attachment.compressUrl,
        ];

  return candidateNames.some((name) => /\.(heic|heif)(\?|#|$)/i.test(name || ''));
}

export function getAttachmentImageThumbnailSrc(attachment: Attachment) {
  const compatibleStill = attachment.compressUrl || attachment.posterUrl || '';
  if (isHeicLikeAttachment(attachment)) {
    return compatibleStill;
  }
  return compatibleStill || attachment.url || '';
}

export function getAttachmentImagePreviewSrc(attachment: Attachment) {
  return getAttachmentImageThumbnailSrc(attachment);
}

export function getAttachmentLivePhotoPlaybackSrc(attachment: Attachment) {
  if (getAttachmentMediaKind(attachment) !== 'livePhoto') {
    return '';
  }

  return attachment.details?.pairedVideoUrl || '';
}

export function isImageLikeAttachment(attachment: File | Attachment) {
  const mediaKind = getAttachmentMediaKind(attachment);
  return mediaKind === 'image' || mediaKind === 'livePhoto';
}
