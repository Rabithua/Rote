import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  deleteMyOneOpenKey,
  editMyOneOpenKey,
  generateOpenKey,
  getMyOpenKey,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse, isValidUUID } from '../../utils/main';

// API密钥相关路由
const apiKeysRouter = new Hono<{ Variables: HonoVariables }>();

// 生成API密钥
apiKeysRouter.post('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  if (!user.id) {
    throw new Error('User ID is required');
  }

  const data = await generateOpenKey(user.id);
  return c.json(createResponse(data), 201);
});

// 获取所有API密钥
apiKeysRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  if (!user.id) {
    throw new Error('User ID is required');
  }

  const data = await getMyOpenKey(user.id);
  return c.json(createResponse(data), 200);
});

// 更新API密钥
apiKeysRouter.put('/:id', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { permissions } = body;

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
