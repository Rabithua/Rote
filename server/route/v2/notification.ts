import { Hono } from 'hono';
import { requireNotificationConfig } from '../../middleware/configCheck';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';

/**
 * 通知路由
 *
 * ⚠️ 注意：此路由的功能已被禁用
 * - 定时任务功能（NoteOnceNoticeJob）已移除
 * - 当前路由仅作为占位符保留，以维持 API 结构完整性
 * - 所有请求将返回成功响应但不执行任何操作
 * - 未来可能会重构或完全移除此路由
 *
 * 如需发送通知，请使用订阅相关的 API：
 * - POST /subscriptions/:id/notify - 触发特定订阅的通知
 * - POST /subscriptions/test-all - 测试所有订阅端点
 */

// 定时任务功能已移除，占位常量与空实现
const JobNames = { NoteOnceNoticeJob: 'NoteOnceNoticeJob' } as const;

// 通知相关路由
const notificationsRouter = new Hono<{ Variables: HonoVariables }>();

// 创建通知（功能已禁用）
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
        // 仅返回成功响应以保持 API 兼容性
        break;

      default:
        throw new Error('Invalid notification type');
    }

    // 返回成功响应但不执行任何操作
    return c.json(createResponse(), 201);
  }
);

export default notificationsRouter;
