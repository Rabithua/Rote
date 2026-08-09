import { Hono } from 'hono';
import { getEffectiveCapabilitiesForUser } from '../../authz/capabilityService';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';

type PermissionsAuthentication = (
  context: HonoContext,
  next: () => Promise<void>
) => Promise<Response | void>;

export function createPermissionsRouter(params?: {
  authenticate?: PermissionsAuthentication;
  getCapabilities?: typeof getEffectiveCapabilitiesForUser;
}) {
  const permissionsRouter = new Hono<{ Variables: HonoVariables }>();
  const authenticate = params?.authenticate ?? authenticateJWT;
  const getCapabilities = params?.getCapabilities ?? getEffectiveCapabilitiesForUser;

  permissionsRouter.get('/me', authenticate, async (c: HonoContext) => {
    const user = c.get('user')!;
    const data = await getCapabilities(user.id);
    return c.json(createResponse(data), 200);
  });

  return permissionsRouter;
}

export default createPermissionsRouter();
