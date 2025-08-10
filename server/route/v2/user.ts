import { User } from '@prisma/client';
import express from 'express';
import moment from 'moment';
import { authenticateJWT } from '../../middleware/jwtAuth';
import {
  editMyProfile,
  exportData,
  getHeatMap,
  getMyTags,
  getUserInfoByUsername,
  statistics,
} from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';

// 用户相关路由
const usersRouter = express.Router();

// 获取用户信息
usersRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username) {
      throw new Error('Username is required');
    }

    const data = await getUserInfoByUsername(username.toString());
    res.status(200).json(createResponse(data));
  })
);

// 获取当前用户个人资料
usersRouter.get(
  '/me/profile',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    res.status(200).json(createResponse(req.user as User));
  })
);

// 更新当前用户个人资料
usersRouter.put(
  '/me/profile',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await editMyProfile(user.id, req.body);

    res.status(200).json(createResponse(data));
  })
);

// 获取用户标签
usersRouter.get(
  '/me/tags',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await getMyTags(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 获取用户热力图数据
usersRouter.get(
  '/me/heatmap',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const data = await getHeatMap(user.id, startDate as string, endDate as string);
    res.status(200).json(createResponse(data));
  })
);

// 获取用户统计信息
usersRouter.get(
  '/me/statistics',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await statistics(user.id);

    res.status(200).json(createResponse(data));
  })
);

// 导出用户数据
usersRouter.get(
  '/me/export',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await exportData(user.id);

    const jsonData = JSON.stringify(data);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${user.username}-${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`
    );

    res.send(jsonData);
  })
);

export default usersRouter;
