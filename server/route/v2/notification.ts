import express from 'express';
import { requireNotificationConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { asyncHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';
// 定时任务功能已移除，占位常量与空实现
const JobNames = { NoteOnceNoticeJob: 'NoteOnceNoticeJob' } as const;

// 通知相关路由
const notificationsRouter = express.Router();

// 创建通知
notificationsRouter.post(
  '/',
  authenticateJWT,
  requireNotificationConfig,
  asyncHandler(async (req, res) => {
    const { type } = req.body;

    switch (type) {
      case JobNames.NoteOnceNoticeJob:
        // 定时任务已禁用：此分支不执行任何操作
        break;

      default:
        throw new Error('Invalid notification type');
    }

    res.status(201).json(createResponse());
  })
);

export default notificationsRouter;
