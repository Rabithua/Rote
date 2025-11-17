import { User } from '@prisma/client';
import { Hono } from 'hono';
import moment from 'moment';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { HonoContext } from '../../types/hono';
import {
  editMyProfile,
  exportData,
  getHeatMap,
  getMyProfile,
  getMyTags,
  getUserInfoByUsername,
  statistics,
} from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';

// 用户相关路由
const usersRouter = new Hono<{ Variables: HonoContext['Variables'] }>();

// 获取用户信息
usersRouter.get('/:username', async (c: HonoContext) => {
  const username = c.req.param('username');
  if (!username) {
    throw new Error('Username is required');
  }

  const data = await getUserInfoByUsername(username);
  return c.json(createResponse(data), 200);
});

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
  const data = await editMyProfile(user.id, body);

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

export default usersRouter;
