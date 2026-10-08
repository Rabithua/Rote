import { Hono } from 'hono';
import { z } from 'zod';
import { deleteUnboundAttachments } from '../../../attachments/unboundCleanup';
import { getAttachmentUploadPolicy } from '../../../attachments/uploadPolicy';
import {
  parseOpenKeyImport,
  requireImportPermissions,
  OPENKEY_IMPORT_BATCH_SIZE,
} from '../../../imports/openKeyImportPolicy';
import { cancelUploadReservation, getPendingUploadReservation } from '../../../resources/service';
import type { StorageConfig } from '../../../types/config';
import type { HonoVariables } from '../../../types/hono';
import { getGlobalConfig } from '../../../utils/config';
import { getMyProfile, importData, planImportData } from '../../../utils/dbMethods';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
  MAX_FILES,
} from '../../../utils/fileValidation';
import { createResponse } from '../../../utils/main';
import { requireOpenKey } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

router.post('/imports/connect', async (c) => {
  const key = requireOpenKey(c);
  requireImportPermissions(key.permissions, ['SENDROTE', 'GETROTE']);
  const [profile, uploadPolicy] = await Promise.all([
    getMyProfile(key.userid),
    getAttachmentUploadPolicy(key.userid),
  ]);
  const storage = getGlobalConfig<StorageConfig>('storage');
  const storageAvailable = Boolean(
    storage?.endpoint && storage.bucket && storage.accessKeyId && storage.secretAccessKey
  );
  c.header('Cache-Control', 'no-store');
  return c.json(
    createResponse({
      protocolVersion: 1,
      owner: { id: key.userid, username: profile.username, nickname: profile.nickname },
      permissions: key.permissions,
      capabilities: {
        formalImport: 2,
        sourceIdentity: true,
        historicalCreatedAt: true,
        bindUnboundAttachments: true,
        batchSize: OPENKEY_IMPORT_BATCH_SIZE,
        attachments:
          storageAvailable &&
          uploadPolicy.canUploadAttachments &&
          key.permissions.includes('UPLOADATTACHMENT'),
        video:
          storageAvailable &&
          uploadPolicy.canUploadVideo &&
          key.permissions.includes('UPLOADATTACHMENT') &&
          key.permissions.includes('UPLOADVIDEO'),
        overwrite: key.permissions.includes('EDITROTE'),
        articles:
          key.permissions.includes('SENDARTICLE') && key.permissions.includes('EDITARTICLE'),
        cleanupUnbound: true,
        browserDirectUpload: true,
        imageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
        videoMimeTypes: ALLOWED_VIDEO_MIME_TYPES,
        maxImageBytes: MAX_IMAGE_FILE_SIZE,
        maxVideoBytes: uploadPolicy.maxVideoUploadSizeMB * 1024 * 1024,
        maxAttachments: MAX_FILES,
      },
    })
  );
});

router.post('/imports/plan', async (c) => {
  const key = requireOpenKey(c);
  const payload = parseOpenKeyImport(await c.req.json(), key.permissions, true);
  return c.json(createResponse(await planImportData(key.userid, payload)));
});

router.post('/imports', async (c) => {
  const key = requireOpenKey(c);
  const payload = parseOpenKeyImport(await c.req.json(), key.permissions);
  return c.json(createResponse(await importData(key.userid, payload)));
});

router.post('/imports/attachments/cleanup', async (c) => {
  const key = requireOpenKey(c);
  requireImportPermissions(key.permissions, ['UPLOADATTACHMENT']);
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1).max(100) }).parse(await c.req.json());
  return c.json(createResponse(await deleteUnboundAttachments(key.userid, ids)));
});

router.delete('/imports/reservations/:id', async (c) => {
  const key = requireOpenKey(c);
  requireImportPermissions(key.permissions, ['UPLOADATTACHMENT']);
  const id = z.uuid().parse(c.req.param('id'));
  await cancelUploadReservation(key.userid, id);
  // A lost finalize response can leave a completed reservation with unknown attachment ids.
  // Recover its persisted result; the cleanup service still protects bound/profile resources.
  const reservation = await getPendingUploadReservation(key.userid, id);
  if (reservation?.status === 'completed') {
    const result = z.array(z.object({ id: z.uuid() })).safeParse(reservation.result);
    if (result.success) {
      await deleteUnboundAttachments(
        key.userid,
        result.data.map((attachment) => attachment.id)
      );
    }
  }
  return c.json(createResponse(null));
});

export default router;
