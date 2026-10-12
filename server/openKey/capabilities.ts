import { getAttachmentUploadPolicy } from '../attachments/uploadPolicy';
import { OPENKEY_IMPORT_BATCH_SIZE } from '../imports/openKeyImportPolicy';
import type { StorageConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_FILES,
  MAX_IMAGE_FILE_SIZE,
} from '../utils/fileValidation';

export async function getOpenKeyCapabilities(userId: string, permissions: string[]) {
  const uploadPolicy = await getAttachmentUploadPolicy(userId);
  const storage = getGlobalConfig<StorageConfig>('storage');
  const storageAvailable = Boolean(
    storage?.endpoint && storage.bucket && storage.accessKeyId && storage.secretAccessKey
  );
  return {
    ...(permissions.includes('GETROTE') ? { noteCreateIdempotency: 1 } : {}),
    formalImport: 2,
    sourceIdentity: true,
    historicalCreatedAt: true,
    bindUnboundAttachments: true,
    batchSize: OPENKEY_IMPORT_BATCH_SIZE,
    attachments:
      storageAvailable &&
      uploadPolicy.canUploadAttachments &&
      permissions.includes('UPLOADATTACHMENT'),
    video:
      storageAvailable &&
      uploadPolicy.canUploadVideo &&
      permissions.includes('UPLOADATTACHMENT') &&
      permissions.includes('UPLOADVIDEO'),
    overwrite: permissions.includes('EDITROTE'),
    articles: permissions.includes('SENDARTICLE') && permissions.includes('EDITARTICLE'),
    cleanupUnbound: true,
    browserDirectUpload: true,
    imageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    videoMimeTypes: ALLOWED_VIDEO_MIME_TYPES,
    maxImageBytes: MAX_IMAGE_FILE_SIZE,
    maxVideoBytes: uploadPolicy.maxVideoUploadSizeMB * 1024 * 1024,
    maxAttachments: MAX_FILES,
  };
}
