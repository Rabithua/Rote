import type { User } from '@prisma/client';
import { Hono } from 'hono';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  findRoteChangesAfterTimestamp,
  findRoteChangesByOriginId,
  findRoteChangesByRoteId,
  findRoteChangesByUserId,
} from '../../utils/dbMethods';
import { createResponse, isValidUUID } from '../../utils/main';

// 变更记录相关路由
const changeRouter = new Hono<{ Variables: HonoVariables }>();

// 解析时间戳，支持多种格式
function parseTimestamp(timestamp: string): Date {
  // 尝试解析为 Unix 时间戳（支持带小数点的秒或毫秒）
  // 使用 parseFloat 保留小数部分，确保精度
  const unixTimestamp = parseFloat(timestamp);
  if (!isNaN(unixTimestamp) && unixTimestamp > 0) {
    // 判断是秒还是毫秒（大于 10^12 认为是毫秒）
    if (unixTimestamp > 1000000000000) {
      return new Date(unixTimestamp); // 毫秒（支持小数点）
    } else {
      return new Date(unixTimestamp * 1000); // 秒（支持小数点，转换为毫秒）
    }
  }

  // 尝试解析为 ISO 8601 格式
  const isoDate = new Date(timestamp);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  throw new Error('Invalid timestamp format');
}

// 根据原始笔记ID获取变更记录（用于iOS客户端同步）
changeRouter.get('/origin/:originid', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const originid = c.req.param('originid');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');

  // UUID 格式验证
  if (!originid || !isValidUUID(originid)) {
    throw new Error('Invalid or missing origin ID');
  }

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  // 只返回当前用户的变更记录
  const changes = await findRoteChangesByOriginId(originid, user.id, parsedSkip, parsedLimit);

  return c.json(createResponse(changes), 200);
});

// 根据笔记ID获取变更记录
changeRouter.get('/rote/:roteid', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const roteid = c.req.param('roteid');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');

  // UUID 格式验证
  if (!roteid || !isValidUUID(roteid)) {
    throw new Error('Invalid or missing rote ID');
  }

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  // 只返回当前用户的变更记录
  const changes = await findRoteChangesByRoteId(roteid, user.id, parsedSkip, parsedLimit);

  return c.json(createResponse(changes), 200);
});

// 根据用户ID获取变更记录
changeRouter.get('/user', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const action = c.req.query('action');

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;
  const parsedAction =
    typeof action === 'string' && ['CREATE', 'UPDATE', 'DELETE'].includes(action)
      ? (action as 'CREATE' | 'UPDATE' | 'DELETE')
      : undefined;

  const changes = await findRoteChangesByUserId(user.id, parsedSkip, parsedLimit, parsedAction);

  return c.json(createResponse(changes), 200);
});

// 获取指定时间戳之后的变更记录（用于iOS客户端同步）
changeRouter.get('/after', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const timestamp = c.req.query('timestamp');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const action = c.req.query('action');

  if (!timestamp || typeof timestamp !== 'string') {
    throw new Error('Timestamp is required');
  }

  // URL 解码（处理 URL 编码的 ISO 8601 格式）
  const decodedTimestamp = decodeURIComponent(timestamp);

  // 解析时间戳（支持多种格式）
  let timestampDate: Date;
  try {
    timestampDate = parseTimestamp(decodedTimestamp);
  } catch (_error) {
    throw new Error(
      'Invalid timestamp format. Support: ISO 8601, Unix timestamp (seconds or milliseconds)'
    );
  }

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;
  const parsedAction =
    typeof action === 'string' && ['CREATE', 'UPDATE', 'DELETE'].includes(action)
      ? (action as 'CREATE' | 'UPDATE' | 'DELETE')
      : undefined;

  const changes = await findRoteChangesAfterTimestamp(
    timestampDate,
    user.id,
    parsedSkip,
    parsedLimit,
    parsedAction
  );

  return c.json(createResponse(changes), 200);
});

export default changeRouter;
