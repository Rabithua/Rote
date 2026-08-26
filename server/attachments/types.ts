import type { StorageConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';
import attachmentErrors from './errorCodes.json';

export type PresignFileInput = {
  filename?: string;
  contentType?: string;
  size?: number;
  mediaKind?: 'image' | 'video' | 'livePhoto';
  pairedVideo?: {
    filename?: string;
    contentType?: string;
    size?: number;
  };
};

export type FinalizeAttachmentInput = {
  clientId?: string;
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
  mediaKind?: 'image' | 'video' | 'livePhoto';
  hash?: string;
  noteId?: string;
};

export type AttachmentBatchOrderReference =
  | { attachmentId: string; clientId?: never }
  | { attachmentId?: never; clientId: string };

export type FinalizeAttachmentBatchInput = {
  batchId: string;
  reservationId?: string;
  noteId: string;
  attachments: FinalizeAttachmentInput[];
  order: AttachmentBatchOrderReference[];
};

export type FinalizeAttachmentBatchResult = {
  batchId: string;
  attachments: unknown[];
  clientIdMap: Record<string, string>;
  orderedAttachmentIds: string[];
};

export function requireStorageAvailable() {
  const storageConfig = getGlobalConfig<StorageConfig>('storage');
  if (
    !storageConfig ||
    !storageConfig.endpoint ||
    !storageConfig.accessKeyId ||
    !storageConfig.secretAccessKey ||
    !storageConfig.bucket
  ) {
    throw new Error(attachmentErrors.storageNotConfigured);
  }
  return storageConfig;
}
