import { Hono } from 'hono';
import {
  CAPABILITY_KEYS,
  isCapabilityOverride,
  type CapabilityKey,
  type CapabilityOverride,
} from '../../authz/capabilities';
import {
  getRoleCapabilityPolicies,
  getUserCapabilityOverrides,
  setRoleCapabilityPolicies,
  setUserCapabilityOverrides,
} from '../../authz/capabilityService';
import { authenticateJWT, requireAdmin, requireSuperAdmin } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { UserRole } from '../../types/main';
import { createResponse } from '../../utils/main';

const adminPermissionsRouter = new Hono<{ Variables: HonoVariables }>();

function parseCapabilities<T extends string>(
  value: unknown,
  validator: (item: unknown) => item is T
): Partial<Record<CapabilityKey, T>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid capabilities');
  }

  const entries = Object.entries(value);
  if (
    entries.some(
      ([permission, effect]) =>
        !CAPABILITY_KEYS.includes(permission as CapabilityKey) || !validator(effect)
    )
  ) {
    throw new Error('Invalid capabilities');
  }
  return Object.fromEntries(entries) as Partial<Record<CapabilityKey, T>>;
}

adminPermissionsRouter.get('/roles', authenticateJWT, requireAdmin, async (c: HonoContext) =>
  c.json(createResponse(await getRoleCapabilityPolicies()), 200)
);

adminPermissionsRouter.put(
  '/roles/:role',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    const role = c.req.param('role') as UserRole;
    if (!Object.values(UserRole).includes(role) || role === UserRole.SUPER_ADMIN) {
      throw new Error('Invalid role');
    }
    const body = await c.req.json();
    const capabilities = parseCapabilities<CapabilityOverride>(
      body?.capabilities,
      isCapabilityOverride
    );
    return c.json(createResponse(await setRoleCapabilityPolicies(role, capabilities)), 200);
  }
);

adminPermissionsRouter.get(
  '/users/:userId',
  authenticateJWT,
  requireAdmin,
  async (c: HonoContext) =>
    c.json(createResponse(await getUserCapabilityOverrides(c.req.param('userId'))), 200)
);

adminPermissionsRouter.put(
  '/users/:userId',
  authenticateJWT,
  requireSuperAdmin,
  async (c: HonoContext) => {
    const actor = c.get('user')!;
    const body = await c.req.json();
    const capabilities = parseCapabilities<CapabilityOverride>(
      body?.capabilities,
      isCapabilityOverride
    );
    const data = await setUserCapabilityOverrides({
      userId: c.req.param('userId'),
      capabilities,
      updatedBy: actor.id,
      reason: typeof body?.reason === 'string' ? body.reason.trim() : undefined,
    });
    return c.json(createResponse(data), 200);
  }
);

export default adminPermissionsRouter;
