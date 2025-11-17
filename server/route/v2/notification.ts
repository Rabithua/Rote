import { Hono } from 'hono';
import { requireNotificationConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { HonoContext } from '../../types/hono';
import { createResponse } from '../../utils/main';

// 定时任务功能已移除，占位常量与空实现
const JobNames = { NoteOnceNoticeJob: 'NoteOnceNoticeJob' } as const;

// 通知相关路由
const notificationsRouter = new Hono<{ Variables: HonoContext['Variables'] }>();

// 创建通知
notificationsRouter.post(
  '/',
  authenticateJWT,
  requireNotificationConfig,
  async (c: HonoContext) => {
    const body = await c.req.json();
    const { type } = body;

    switch (type) {
      case JobNames.NoteOnceNoticeJob:
        // 定时任务已禁用：此分支不执行任何操作
        break;

      default:
        throw new Error('Invalid notification type');
    }

    return c.json(createResponse(), 201);
  }
);

export default notificationsRouter;
