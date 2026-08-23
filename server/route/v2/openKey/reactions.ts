import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import { assertUsersMayInteract } from '../../../userBlocks/service';
import { addReaction, findRoteById, removeReaction } from '../../../utils/dbMethods';
import { createResponse } from '../../../utils/main';
import { ReactionCreateZod } from '../../../utils/zod';
import { requireOpenKey, requireOpenKeyPerm } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

const ReactionDeleteZod = z.object({
  roteid: z.string().uuid('Invalid rote ID format'),
  type: z.string().min(1, 'Type and rote ID are required').max(100),
});

router.post('/reactions', requireOpenKeyPerm('ADDREACTION'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const { type, roteid, metadata } = ReactionCreateZod.parse(await c.req.json());
  const note = await findRoteById(roteid);
  if (!note) throw new Error('Rote not found');
  await assertUsersMayInteract(openKey.userid, note.authorid);
  const reaction = await addReaction({
    type,
    roteid,
    userid: openKey.userid,
    metadata,
  });
  return c.json(createResponse(reaction), 201);
});

router.delete(
  '/reactions/:roteid/:type',
  requireOpenKeyPerm('DELETEREACTION'),
  async (c: HonoContext) => {
    const openKey = requireOpenKey(c);
    const { roteid, type } = ReactionDeleteZod.parse({
      roteid: c.req.param('roteid'),
      type: c.req.param('type'),
    });
    const reaction = await removeReaction({ type, roteid, userid: openKey.userid });
    return c.json(createResponse(reaction), 200);
  }
);

export default router;
