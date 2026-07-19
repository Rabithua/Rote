import { Hono } from 'hono';
import { requestWereadGateway, WereadGatewayError } from '../../integrations/wereadGateway';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';

const importsRouter = new Hono<{ Variables: HonoVariables }>();

importsRouter.post('/weread', authenticateJWT, async (c: HonoContext) => {
  try {
    const data = await requestWereadGateway({
      apiKey: c.req.header('x-weread-api-key')?.trim(),
      body: await c.req.json().catch(() => null),
    });
    return c.json(createResponse(data), 200);
  } catch (error) {
    if (error instanceof WereadGatewayError) {
      return c.json(
        createResponse(null, error.code, 1),
        error.status as 400 | 401 | 403 | 502 | 504
      );
    }
    throw error;
  }
});

export default importsRouter;
