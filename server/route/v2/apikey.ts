import { Hono } from 'hono';
import mainJson from '../../json/main.json';
import type { User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  deleteMyOneOpenKey,
  editMyOneOpenKey,
  generateOpenKey,
  getMyOpenKeysWithStats,
  getOpenKeyUsageLogs,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse, isValidUUID } from '../../utils/main';
import { ResourcePolicyError } from '../../resources/errors';

// API密钥相关路由
const apiKeysRouter = new Hono<{ Variables: HonoVariables }>();
const OPENKEY_PERMISSION_SET = new Set(mainJson.openkeyPermissions);

function normalizeAndValidatePermissions(raw: unknown): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error('Permissions wrong!');
  }

  const normalized = raw.map((item) => {
    if (typeof item !== 'string') {
      throw new Error('Permissions wrong!');
    }
    return item.trim();
  });

  if (normalized.some((p) => p.length === 0)) {
    throw new Error('Permissions wrong!');
  }

  const invalid = normalized.filter((p) => !OPENKEY_PERMISSION_SET.has(p));
  if (invalid.length > 0) {
    throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  }

  return Array.from(new Set(normalized));
}

// 生成API密钥
apiKeysRouter.post('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json().catch(() => ({}));
  const permissions = normalizeAndValidatePermissions((body as any).permissions);

  if (!user.id) {
    throw new Error('User ID is required');
  }

  try {
    const data = await generateOpenKey(user.id, permissions);
    return c.json(createResponse(data), 201);
  } catch (error) {
    if (error instanceof ResourcePolicyError) {
      return c.json(createResponse(null, error.code), error.status);
    }
    throw error;
  }
});

// 获取所有API密钥（带统计）
apiKeysRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  if (!user.id) {
    throw new Error('User ID is required');
  }

  const data = await getMyOpenKeysWithStats(user.id);
  return c.json(createResponse(data), 200);
});

// 获取API密钥使用日志
apiKeysRouter.get('/:id/logs', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  const skip = parseInt(c.req.query('skip') || '0');
  const limit = parseInt(c.req.query('limit') || '50');

  if (!user.id) {
    throw new Error('User ID is required');
  }

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid API Key ID');
  }

  // 获取用户的所有 OpenKeys 检查权限
  const userOpenKeys = await getMyOpenKeysWithStats(user.id);
  const hasAccess = userOpenKeys.some((key: any) => key.id === id);
  if (!hasAccess) {
    throw new Error('Unauthorized to view this API key logs');
  }

  const data = await getOpenKeyUsageLogs(id, limit, skip);
  return c.json(createResponse(data), 200);
});

// 更新API密钥
apiKeysRouter.put('/:id', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  const body = await c.req.json();
  const permissions = normalizeAndValidatePermissions((body as any).permissions);

  if (!user.id) {
    throw new Error('User ID is required');
  }

  if (!id || !permissions) {
    throw new Error('API Key ID and permissions are required');
  }

  const data = await editMyOneOpenKey(user.id, id, permissions);
  return c.json(createResponse(data), 200);
});

// 删除API密钥
apiKeysRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  if (!user.id) {
    throw new Error('User ID is required');
  }

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid API Key ID');
  }

  const data = await deleteMyOneOpenKey(user.id, id);
  return c.json(createResponse(data), 200);
});

export default apiKeysRouter;
