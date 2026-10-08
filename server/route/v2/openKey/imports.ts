import { Hono } from 'hono';
import { z } from 'zod';
import { deleteUnboundAttachments } from '../../../attachments/unboundCleanup';
import { authorizeOpenKeyImportAttachments } from '../../../imports/openKeyImportAttachments';
import { parseOpenKeyImport, requireImportPermissions } from '../../../imports/openKeyImportPolicy';
import { cancelUploadReservation, getPendingUploadReservation } from '../../../resources/service';
import type { HonoVariables } from '../../../types/hono';
import { importData, planImportData } from '../../../utils/dbMethods';
import { createResponse } from '../../../utils/main';
import { requireOpenKey } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

router.post('/imports/plan', async (c) => {
  const key = requireOpenKey(c);
  const payload = parseOpenKeyImport(await c.req.json(), key.permissions, true);
  return c.json(createResponse(await planImportData(key.userid, payload)));
});

router.post('/imports', async (c) => {
  const key = requireOpenKey(c);
  const payload = parseOpenKeyImport(await c.req.json(), key.permissions);
  await authorizeOpenKeyImportAttachments(key.userid, key.permissions, payload);
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
