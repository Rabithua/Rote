import { User } from '@prisma/client';
import { Hono } from 'hono';
import { authenticateJWT } from '../../middleware/jwtAuth';
import { HonoContext } from '../../types/hono';
import {
  addSubScriptionToUser,
  deleteSubScription,
  findSubScriptionToUser,
  findSubScriptionToUserByendpoint,
  findSubScriptionToUserByUserId,
  updateSubScription,
} from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';
import webpush from '../../utils/webpush';

// 订阅相关路由
const subscriptionsRouter = new Hono<{ Variables: HonoContext['Variables'] }>();

// 添加订阅
subscriptionsRouter.post('/', authenticateJWT, async (c: HonoContext) => {
  const body = await c.req.json();
  const subscription = body;
  const user = c.get('user') as User;

  if (!subscription) {
    throw new Error('Subscription information is required');
  }

  const existingSubscription = await findSubScriptionToUserByendpoint(subscription.endpoint);
  if (existingSubscription) {
    return c.json(createResponse(existingSubscription), 200);
  }

  const result = await addSubScriptionToUser(user.id, subscription);
  return c.json(createResponse(result), 201);
});

// 获取用户订阅
subscriptionsRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const data = await findSubScriptionToUserByUserId(user.id);
  return c.json(createResponse(data), 200);
});

// 删除订阅
subscriptionsRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const id = c.req.param('id');
  const user = c.get('user') as User;

  if (!id) {
    throw new Error('Subscription ID is required');
  }

  const subscription = await findSubScriptionToUser(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.userid !== user.id) {
    throw new Error('User does not match');
  }

  const data = await deleteSubScription(id);
  return c.json(createResponse(data), 200);
});

// 批量测试所有端点
subscriptionsRouter.post('/test-all', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;

  // 检查 webpush 是否已正确配置
  if (!webpush) {
    throw new Error('Web push service not configured. Please check VAPID keys.');
  }

  // 获取用户所有订阅
  const subscriptions = await findSubScriptionToUserByUserId(user.id);

  const testResults: Array<{
    id: string;
    status: 'success' | 'failed';
    error?: string;
  }> = [];

  // 测试消息
  const testMessage = {
    title: '端点测试',
    body: '这是一条测试消息，用于验证端点是否可用。',
    image: `https://r2.rote.ink/others%2Flogo.png`,
    data: {
      type: 'test',
      url: 'https://rabithua.club',
    },
  };

  // 批量测试所有端点
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(testMessage)
      );

      testResults.push({
        id: subscription.id,
        status: 'success',
      });

      // 如果测试成功且当前状态不是active，更新为active
      if (subscription.status !== 'active') {
        await updateSubScription(subscription.id, user.id, { status: 'active' });
      }
    } catch (error: any) {
      testResults.push({
        id: subscription.id,
        status: 'failed',
        error: error.message || 'Unknown error',
      });

      // 如果测试失败，更新状态为inactive
      await updateSubScription(subscription.id, user.id, { status: 'inactive' });
    }
  }

  return c.json(
    createResponse({
      totalTested: subscriptions.length,
      results: testResults,
      summary: {
        success: testResults.filter((r) => r.status === 'success').length,
        failed: testResults.filter((r) => r.status === 'failed').length,
      },
    }),
    200
  );
});

// 更新订阅
subscriptionsRouter.put('/:id', authenticateJWT, async (c: HonoContext) => {
  console.log('Updating subscription...');

  const id = c.req.param('id');
  const user = c.get('user') as User;
  const body = await c.req.json();
  const updateData = body;

  if (!id) {
    throw new Error('Subscription ID is required');
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    throw new Error('Update data is required');
  }

  const data = await updateSubScription(id, user.id, updateData);
  return c.json(createResponse(data), 200);
});

// 发送通知
subscriptionsRouter.post('/:id/notify', async (c: HonoContext) => {
  console.log('Sending PWA notification...');

  const id = c.req.param('id');
  const body = await c.req.json();
  const message = body;

  if (!webpush) {
    throw new Error('Valid keys not found');
  }

  if (!id || !message) {
    throw new Error('Subscription ID and message are required');
  }

  const subscription = await findSubScriptionToUser(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  try {
    let result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify({ ...message })
    );

    // 推送成功，如果订阅状态不是active，更新为active
    if (subscription.status !== 'active') {
      await updateSubScription(subscription.id, subscription.userid, { status: 'active' });
    }

    return c.json(createResponse(result, 'PWA Notification sent successfully'), 200);
  } catch (error: any) {
    // 处理推送失败的情况
    console.error(`Push notification failed for subscription ${id}:`, error);

    // 根据错误状态码处理不同情况
    if (error.statusCode === 410) {
      // 410 Gone - 订阅已失效，标记为inactive
      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
      throw new Error('Subscription expired and has been marked as inactive');
    } else if (error.statusCode === 403) {
      // 403 Forbidden - VAPID 密钥不匹配，需要重新订阅
      // 这通常发生在 VAPID 密钥被更改后，旧的订阅无法使用新的密钥发送通知
      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
      throw new Error(
        'VAPID key mismatch: The subscription was created with a different VAPID key. Please re-subscribe to receive notifications.'
      );
    } else if (error.statusCode === 413) {
      // 413 Payload Too Large
      throw new Error('Message payload too large');
    } else if (error.statusCode === 400) {
      // 400 Bad Request - 可能是消息格式错误
      throw new Error('Invalid message format or subscription data');
    } else if (error.statusCode === 429) {
      // 429 Too Many Requests
      throw new Error('Rate limit exceeded, please try again later');
    } else if (error.statusCode === 500) {
      // 500 Internal Server Error - 推送服务临时故障，不标记订阅为inactive
      throw new Error('Push service temporarily unavailable, please try again later');
    } else if (error.statusCode >= 500) {
      // 其他5xx错误 - 服务器错误，不标记订阅为inactive
      throw new Error('Push service error, please try again later');
    } else {
      // 4xx客户端错误，标记订阅为inactive并抛出通用错误
      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
      throw new Error(`Push notification failed: ${error.message || 'Unknown error'}`);
    }
  }
});

export default subscriptionsRouter;
