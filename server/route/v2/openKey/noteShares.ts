import { Hono } from 'hono';
import { shareHeaders } from '../../../noteShares/headers';
import { manageNoteShare, ShareNoteNotFound } from '../../../noteShares/repository';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import { createResponse, isValidUUID } from '../../../utils/main';
import { requireOpenKey, requireOpenKeyPerm } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

router.use('/notes/:id/share', shareHeaders);
router.on(
  ['GET', 'PUT', 'DELETE'],
  '/notes/:id/share',
  requireOpenKeyPerm('SHAREROTE'),
  async (c: HonoContext) => {
    const noteId = c.req.param('id');
    if (!isValidUUID(noteId)) throw new ShareNoteNotFound();
    const operation =
      c.req.method === 'PUT' ? 'create' : c.req.method === 'DELETE' ? 'revoke' : 'read';
    const share = await manageNoteShare(requireOpenKey(c).userid, noteId, operation);
    return c.json(createResponse(share));
  }
);

export default router;
