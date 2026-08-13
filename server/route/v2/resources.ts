import { Hono } from 'hono';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';
import { getResourceState } from '../../resources/service';

const resourcesRouter = new Hono<{ Variables: HonoVariables }>();

resourcesRouter.get('/me', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user');
  if (!user) return c.json(createResponse(null, 'Authentication required'), 401);
  return c.json(createResponse(await getResourceState(user)), 200);
});

export default resourcesRouter;
