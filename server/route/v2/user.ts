import { Hono } from 'hono';
import moment from 'moment';
import type { User } from '../../drizzle/schema';
import { authenticateJWT, optionalJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  blockUser,
  getBlockedUsers,
  getViewerAwarePublicUserProfile,
  unblockUser,
} from '../../userBlocks/service';
import {
  deleteUserAccount,
  editMyProfile,
  exportData,
  getHeatMap,
  getMyProfile,
  getMySettings,
  getMyTags,
  importData,
  oneUser,
  planImportData,
  statistics,
  updateMySettings,
} from '../../utils/dbMethods';
import { createResponse, isValidUUID } from '../../utils/main';
import { UsernameUpdateZod } from '../../utils/zod';

// 用户相关路由
const usersRouter = new Hono<{ Variables: HonoVariables }>();

// 获取当前用户个人资料
usersRouter.get('/me/profile', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const data = await getMyProfile(user.id);
  return c.json(createResponse(data), 200);
});

// 更新当前用户个人资料
usersRouter.put('/me/profile', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();

  // 如果提供了 username 字段，进行验证
  if (body.username !== undefined) {
    UsernameUpdateZod.parse({ username: body.username });
  }

  const data = await editMyProfile(user.id, body);

  return c.json(createResponse(data), 200);
});

// 获取当前用户设置（例如探索页展示）
usersRouter.get('/me/settings', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const data = await getMySettings(user.id);
  return c.json(createResponse(data), 200);
});

// 更新当前用户设置（例如探索页展示）
usersRouter.put('/me/settings', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const data = await updateMySettings(user.id, body);

  return c.json(createResponse(data), 200);
});

// 获取用户标签
usersRouter.get('/me/tags', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  if (!user.id) {
    throw new Error('User ID is required');
  }

  const data = await getMyTags(user.id);
  return c.json(createResponse(data), 200);
});

// 获取用户热力图数据
usersRouter.get('/me/heatmap', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  const data = await getHeatMap(user.id, startDate, endDate);
  return c.json(createResponse(data), 200);
});

// 获取用户统计信息
usersRouter.get('/me/statistics', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const data = await statistics(user.id);

  return c.json(createResponse(data), 200);
});

// 导出用户数据
usersRouter.get('/me/export', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const data = await exportData(user.id);

  const jsonData = JSON.stringify(data);

  c.header('Content-Type', 'application/json');
  c.header(
    'Content-Disposition',
    `attachment; filename=${user.username}-${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`
  );

  return c.text(jsonData);
});

usersRouter.get('/me/blocks', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const blocks = await getBlockedUsers(user.id);
  return c.json(createResponse(blocks), 200);
});

usersRouter.put('/me/blocks/:targetUserId', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const targetUserId = c.req.param('targetUserId');
  if (!targetUserId || !isValidUUID(targetUserId)) {
    throw new Error('Invalid target user ID');
  }

  const result = await blockUser(user.id, targetUserId);
  return c.json(createResponse(result), 200);
});

usersRouter.delete('/me/blocks/:targetUserId', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const targetUserId = c.req.param('targetUserId');
  if (!targetUserId || !isValidUUID(targetUserId)) {
    throw new Error('Invalid target user ID');
  }

  const result = await unblockUser(user.id, targetUserId);
  return c.json(createResponse(result), 200);
});

// 导入用户数据
usersRouter.post('/me/import', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();

  const result = await importData(user.id, body);
  return c.json(createResponse(result), 200);
});

usersRouter.post('/me/import/plan', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const result = await planImportData(user.id, await c.req.json());
  return c.json(createResponse(result), 200);
});

// 删除当前用户账户
usersRouter.delete('/me', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const body = await c.req.json();
  const { password } = body;

  // 获取完整用户信息以检查是否有密码
  const fullUser = await oneUser(user.id);
  if (!fullUser) {
    throw new Error('User not found');
  }

  // OAuth 用户不需要密码，但为了保持 API 一致性，仍然需要传递一个占位符
  // 有密码的用户必须提供密码
  if (fullUser.passwordhash && fullUser.salt && !password) {
    throw new Error('Password is required for users with password');
  }

  // 对于 OAuth 用户，如果没有提供密码，使用占位符
  const passwordToVerify = password || 'oauth_user_placeholder';

  const data = await deleteUserAccount(user.id, passwordToVerify);
  return c.json(createResponse(data), 200);
});

// 获取公开用户信息。屏蔽者仍可看到目标资料以便解除屏蔽；反向屏蔽不泄露。
usersRouter.get('/:username', optionalJWT, async (c: HonoContext) => {
  const username = c.req.param('username');
  if (!username) {
    throw new Error('Username is required');
  }

  const viewer = c.get('user') as User | undefined;
  const data = await getViewerAwarePublicUserProfile(username, viewer?.id);
  return c.json(createResponse(data), 200);
});

export default usersRouter;
