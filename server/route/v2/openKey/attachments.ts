import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import {
  deleteAttachment,
  deleteAttachments,
  findRoteById,
  updateAttachmentsSortOrder,
} from '../../../utils/dbMethods';
import { MAX_BATCH_SIZE } from '../../../utils/fileValidation';
import { createResponse } from '../../../utils/main';
import { assertUuid, requireOpenKey, requireOpenKeyPerm } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

const AttachmentIdsZod = z.object({
  ids: z
    .array(z.string().uuid('Invalid attachment ID'))
    .min(1, 'IDs array is required')
    .max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} IDs allowed`),
});
const AttachmentSortZod = z.object({
  noteId: z.string().uuid('Invalid or missing note ID'),
  attachmentIds: z
    .array(z.string().uuid('Invalid attachment ID'))
    .min(1, 'Attachment IDs array is required')
    .max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} attachments allowed`),
});

router.delete(
  '/attachments/:id',
  requireOpenKeyPerm('DELETEATTACHMENT'),
  async (c: HonoContext) => {
    const openKey = requireOpenKey(c);
    const id = assertUuid(c.req.param('id'), 'Invalid attachment ID');
    const attachment = await deleteAttachment(id, openKey.userid);
    return c.json(createResponse(attachment), 200);
  }
);

router.delete('/attachments', requireOpenKeyPerm('DELETEATTACHMENT'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const { ids } = AttachmentIdsZod.parse(await c.req.json());
  const result = await deleteAttachments(
    ids.map((id) => ({ id })),
    openKey.userid
  );
  return c.json(createResponse(result), 200);
});

router.put('/attachments/sort', requireOpenKeyPerm('EDITROTE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const { noteId, attachmentIds } = AttachmentSortZod.parse(await c.req.json());
  const note = await findRoteById(noteId, openKey.userid);
  if (!note) throw new Error('Note not found');
  if (note.authorid !== openKey.userid) {
    throw new Error('Access denied: note does not belong to you');
  }
  const result = await updateAttachmentsSortOrder(openKey.userid, noteId, attachmentIds);
  return c.json(createResponse(result), 200);
});

export default router;
