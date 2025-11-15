import { User } from '@prisma/client';
import express from 'express';
import { optionalJWT } from '../../middleware/jwtAuth';
import { addReaction, findRoteById, removeReaction } from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { createResponse, isValidUUID } from '../../utils/main';
import { ReactionCreateZod } from '../../utils/zod';

// 反应相关路由
const reactionsRouter = express.Router();

// 为 reactions 路由添加可选JWT认证
reactionsRouter.use(optionalJWT);

// 添加反应
reactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { type, roteid, visitorId, visitorInfo, metadata } = req.body;

    // 如果用户未登录，visitorId 是必需的
    if (!user && !visitorId) {
      throw new Error('Visitor ID is required for unauthenticated users');
    }

    // 验证输入长度和格式
    ReactionCreateZod.parse(req.body);

    // 验证 roteid 格式（zod 已经验证了 UUID 格式，但保留双重检查）
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    // 检查笔记是否存在
    const rote = await findRoteById(roteid);
    if (!rote) {
      throw new Error('Rote not found');
    }

    // 构建反应数据
    const reactionData: any = {
      type,
      roteid,
      metadata,
    };

    if (user) {
      // 已登录用户
      reactionData.userid = user.id;
    } else {
      // 访客用户（visitorId 已在前面验证）
      reactionData.visitorId = visitorId;
      reactionData.visitorInfo = visitorInfo;
    }

    const reaction = await addReaction(reactionData);
    res.status(201).json(createResponse(reaction));
  })
);

// 删除反应
reactionsRouter.delete(
  '/:roteid/:type',
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { roteid, type } = req.params;
    const { visitorId } = req.query;

    if (!type || !roteid) {
      throw new Error('Type and rote ID are required');
    }

    // 验证 roteid 格式
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    // 构建删除条件
    const removeData: any = {
      type,
      roteid,
    };

    if (user) {
      removeData.userid = user.id;
    } else {
      if (!visitorId) {
        throw new Error('Visitor ID is required for unauthenticated users');
      }
      removeData.visitorId = visitorId as string;
    }

    const result = await removeReaction(removeData);
    res.status(200).json(createResponse(result));
  })
);

export default reactionsRouter;
