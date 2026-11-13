import { Hono } from 'hono';
import { z } from 'zod';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { currentGiftForUser, markShown } from '../../gift/service';
import { GiftApiError } from '../../gift/errors';
import type { User } from '../../drizzle/schema';
import type { HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';

const router = new Hono<{ Variables: HonoVariables }>();

router.use('*', authenticateJWT);

// The app's only gift touchpoints: "what is waiting for me" and "I saw it".
// Admin operations (import/allocate/funnel) live exclusively in the MCP
// gift tools, never in HTTP.
router.get('/current', async (c) => {
  const user = c.get('user') as User;
  const offer = await currentGiftForUser(user.id);
  return c.json(createResponse(offer), 200);
});

const shownParamsSchema = z.object({ codeId: z.uuid() });

router.post('/:codeId/shown', async (c) => {
  const user = c.get('user') as User;
  const parsed = shownParamsSchema.safeParse({ codeId: c.req.param('codeId') });
  if (!parsed.success) {
    throw new GiftApiError('gift_invalid_request', 400);
  }
  const result = await markShown(parsed.data.codeId, user.id);
  if (result === 'unknown') {
    // Unknown or foreign codes must not confirm anything.
    throw new GiftApiError('gift_not_available', 404);
  }
  return c.json(createResponse({ marked: true }), 200);
});

export default router;
