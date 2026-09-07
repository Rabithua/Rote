import { Hono } from 'hono';
import type { HonoVariables } from '../types/hono';
import { authenticateJWT } from '../middleware/jwtAuth';
import { createResponse, isValidUUID } from '../utils/main';
import { shareHeaders } from './headers';
import { manageNoteShare, readSharedNote, ShareNoteNotFound } from './repository';

const router = new Hono<{ Variables: HonoVariables }>();

router.use('/notes/:id/share', shareHeaders);
router.use('/shares/*', shareHeaders);

router.onError((error, c) => {
  if (error instanceof ShareNoteNotFound) {
    return c.json(createResponse(null, 'share_not_found', 404), 404);
  }
  // Database errors can include bound query parameters. Do not pass a bearer
  // token to the global development error logger or an error response.
  process.stderr.write(`note_share_request_failed method=${c.req.method}\n`);
  return c.json(createResponse(null, 'share_request_failed', 500), 500);
});

router.on(['GET', 'PUT', 'DELETE'], '/notes/:id/share', authenticateJWT, async (c) => {
  const noteId = c.req.param('id');
  if (!isValidUUID(noteId)) throw new ShareNoteNotFound();
  const operation =
    c.req.method === 'PUT' ? 'create' : c.req.method === 'DELETE' ? 'revoke' : 'read';
  const share = await manageNoteShare(c.get('user')!.id, noteId, operation);
  return c.json(createResponse(share));
});

router.get('/shares/:token', async (c) => {
  const note = await readSharedNote(c.req.param('token'));
  if (!note) throw new ShareNoteNotFound();
  return c.json(createResponse(note));
});

export default router;
