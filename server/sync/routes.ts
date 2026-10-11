import { Hono } from 'hono';
import type { User } from '../drizzle/schema';
import { authenticateJWT } from '../middleware/jwtAuth';
import type { HonoVariables } from '../types/hono';
import { createResponse } from '../utils/main';
import { readSyncChanges, readSyncSnapshot } from './repository';

const syncRouter = new Hono<{ Variables: HonoVariables }>();
syncRouter.use('*', authenticateJWT);

syncRouter.get('/snapshot', async (context) => {
  const user = context.get('user') as User;
  return context.json(createResponse(await readSyncSnapshot(user.id)), 200);
});

syncRouter.get('/changes', async (context) => {
  const user = context.get('user') as User;
  const limit = context.req.query('limit');
  return context.json(
    createResponse(
      await readSyncChanges(
        user.id,
        context.req.query('cursor'),
        limit === undefined ? 100 : Number(limit)
      )
    ),
    200
  );
});

export default syncRouter;
