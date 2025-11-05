import { User } from '@prisma/client';
import express from 'express';
import { authenticateJWT } from '../../middleware/jwtAuth';
import {
  findRoteChangesAfterTimestamp,
  findRoteChangesByOriginId,
  findRoteChangesByRoteId,
  findRoteChangesByUserId,
} from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { createResponse, isValidUUID } from '../../utils/main';

// 变更记录相关路由
const changeRouter = express.Router();

// 根据原始笔记ID获取变更记录（用于iOS客户端同步）
changeRouter.get(
  '/origin/:originid',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { originid } = req.params;
    const { skip, limit } = req.query;

    // UUID 格式验证
    if (!originid || !isValidUUID(originid)) {
      throw new Error('Invalid or missing origin ID');
    }

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    // 只返回当前用户的变更记录
    const changes = await findRoteChangesByOriginId(originid, user.id, parsedSkip, parsedLimit);

    res.status(200).json(createResponse(changes));
  })
);

// 根据笔记ID获取变更记录
changeRouter.get(
  '/rote/:roteid',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { roteid } = req.params;
    const { skip, limit } = req.query;

    // UUID 格式验证
    if (!roteid || !isValidUUID(roteid)) {
      throw new Error('Invalid or missing rote ID');
    }

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    // 只返回当前用户的变更记录
    const changes = await findRoteChangesByRoteId(roteid, user.id, parsedSkip, parsedLimit);

    res.status(200).json(createResponse(changes));
  })
);

// 根据用户ID获取变更记录
changeRouter.get(
  '/user',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { skip, limit, action } = req.query;

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;
    const parsedAction =
      typeof action === 'string' && ['CREATE', 'UPDATE', 'DELETE'].includes(action)
        ? (action as 'CREATE' | 'UPDATE' | 'DELETE')
        : undefined;

    const changes = await findRoteChangesByUserId(user.id, parsedSkip, parsedLimit, parsedAction);

    res.status(200).json(createResponse(changes));
  })
);

// 解析时间戳，支持多种格式
function parseTimestamp(timestamp: string): Date {
  // 尝试解析为 Unix 时间戳（秒）
  const unixSeconds = parseInt(timestamp, 10);
  if (!isNaN(unixSeconds) && unixSeconds > 0) {
    // 判断是秒还是毫秒（大于 10^12 认为是毫秒）
    if (unixSeconds > 1000000000000) {
      return new Date(unixSeconds); // 毫秒
    } else {
      return new Date(unixSeconds * 1000); // 秒
    }
  }

  // 尝试解析为 ISO 8601 格式
  const isoDate = new Date(timestamp);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  throw new Error('Invalid timestamp format');
}

// 获取指定时间戳之后的变更记录（用于iOS客户端同步）
changeRouter.get(
  '/after',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { timestamp, skip, limit, action } = req.query;

    if (!timestamp || typeof timestamp !== 'string') {
      throw new Error('Timestamp is required');
    }

    // URL 解码（处理 URL 编码的 ISO 8601 格式）
    const decodedTimestamp = decodeURIComponent(timestamp);

    // 解析时间戳（支持多种格式）
    let timestampDate: Date;
    try {
      timestampDate = parseTimestamp(decodedTimestamp);
    } catch (error) {
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

    res.status(200).json(createResponse(changes));
  })
);

export default changeRouter;
