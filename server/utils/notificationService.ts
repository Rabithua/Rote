/**
 * 通知服务 - 统一管理所有推送通知逻辑
 */

import { findAllActiveSubscriptions, updateSubScription } from './dbMethods';
import webpush from './webpush';

export interface NotificationMessage {
  title: string;
  body: string;
  image?: string;
  data?: {
    type: string;
    url?: string;
    noteId?: string;
    authorUsername?: string;
    [key: string]: any;
  };
}

export interface NotificationResult {
  userId: string;
  username: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface NotificationSummary {
  totalNotified: number;
  results: NotificationResult[];
  summary: {
    success: number;
    failed: number;
  };
}

/**
 * 发送公开笔记通知给所有订阅者
 * @param noteData 笔记数据
 * @param author 作者信息
 * @returns 通知发送结果
 */
export async function sendPublicNoteNotification(
  noteData: {
    id: string;
    content: string;
    title?: string;
  },
  author: {
    username: string;
    avatar?: string;
  }
): Promise<NotificationSummary> {
  if (!webpush || !webpush.sendNotification) {
    throw new Error('Web push service not available');
  }

  // 获取所有活跃的订阅
  const subscriptions = await findAllActiveSubscriptions();

  if (subscriptions.length === 0) {
    return {
      totalNotified: 0,
      results: [],
      summary: {
        success: 0,
        failed: 0,
      },
    };
  }

  const notificationResults: NotificationResult[] = [];

  // 构建通知消息
  const message: NotificationMessage = {
    title: '新的公开笔记',
    body: noteData.content.substring(0, 100) + (noteData.content.length > 100 ? '...' : ''),
    image: author.avatar || `https://r2.rote.ink/others%2Flogo.png`,
    data: {
      type: 'public_note',
      noteId: noteData.id,
      authorUsername: author.username,
      url: `https://rote.ink/rote/${noteData.id}`,
    },
  };

  // 批量发送通知
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(message)
      );

      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user.username,
        status: 'success',
      });

      // 如果发送成功且当前状态不是active，更新为active
      if (subscription.status !== 'active') {
        await updateSubScription(subscription.id, subscription.userid, { status: 'active' });
      }
    } catch (error: any) {
      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user.username,
        status: 'failed',
        error: error.message || 'Unknown error',
      });

      // 如果发送失败，更新状态为inactive
      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
    }
  }

  return {
    totalNotified: subscriptions.length,
    results: notificationResults,
    summary: {
      success: notificationResults.filter((r) => r.status === 'success').length,
      failed: notificationResults.filter((r) => r.status === 'failed').length,
    },
  };
}

/**
 * 异步发送公开笔记通知（不阻塞主流程）
 * @param noteData 笔记数据
 * @param author 作者信息
 */
export function sendPublicNoteNotificationAsync(
  noteData: {
    id: string;
    content: string;
    title?: string;
  },
  author: {
    username: string;
    avatar?: string;
  }
): void {
  if (!webpush || !webpush.sendNotification) {
    console.warn('Web push service not available, skipping notification');
    return;
  }

  process.nextTick(async () => {
    try {
      const result = await sendPublicNoteNotification(noteData, author);
      console.log(
        `Public note notification sent to ${result.summary.success} users successfully, ${result.summary.failed} failed`
      );
    } catch (error) {
      console.error('Error processing public note notifications:', error);
    }
  });
}

/**
 * 发送自定义通知给所有订阅者
 * @param message 自定义通知消息
 * @returns 通知发送结果
 */
export async function sendCustomNotificationToAll(
  message: NotificationMessage
): Promise<NotificationSummary> {
  if (!webpush || !webpush.sendNotification) {
    throw new Error('Web push service not available');
  }

  const subscriptions = await findAllActiveSubscriptions();

  if (subscriptions.length === 0) {
    return {
      totalNotified: 0,
      results: [],
      summary: {
        success: 0,
        failed: 0,
      },
    };
  }

  const notificationResults: NotificationResult[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(message)
      );

      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user.username,
        status: 'success',
      });

      if (subscription.status !== 'active') {
        await updateSubScription(subscription.id, subscription.userid, { status: 'active' });
      }
    } catch (error: any) {
      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user.username,
        status: 'failed',
        error: error.message || 'Unknown error',
      });

      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
    }
  }

  return {
    totalNotified: subscriptions.length,
    results: notificationResults,
    summary: {
      success: notificationResults.filter((r) => r.status === 'success').length,
      failed: notificationResults.filter((r) => r.status === 'failed').length,
    },
  };
}

/**
 * 发送测试通知给所有订阅者
 * @returns 通知发送结果
 */
export async function sendTestNotificationToAll(): Promise<NotificationSummary> {
  const testMessage: NotificationMessage = {
    title: '端点测试',
    body: '这是一条测试消息，用于验证端点是否可用。',
    image: `https://r2.rote.ink/others%2Flogo.png`,
    data: {
      type: 'test',
      url: 'https://rabithua.club',
    },
  };

  return await sendCustomNotificationToAll(testMessage);
}

/**
 * 发送测试通知给用户的所有订阅端点
 * @param userId 用户ID
 * @returns 通知发送结果
 */
export async function sendTestNotificationToUser(userId: string): Promise<NotificationSummary> {
  if (!webpush || !webpush.sendNotification) {
    throw new Error('Web push service not available');
  }

  // 获取指定用户的所有订阅
  const { findSubScriptionToUserByUserId } = await import('./dbMethods');
  const subscriptions = await findSubScriptionToUserByUserId(userId);

  if (subscriptions.length === 0) {
    return {
      totalNotified: 0,
      results: [],
      summary: {
        success: 0,
        failed: 0,
      },
    };
  }

  const notificationResults: NotificationResult[] = [];

  // 构建测试消息
  const testMessage: NotificationMessage = {
    title: '端点测试',
    body: '这是一条测试消息，用于验证端点是否可用。',
    image: `https://r2.rote.ink/others%2Flogo.png`,
    data: {
      type: 'test',
      url: 'https://rabithua.club',
    },
  };

  // 批量测试用户的所有端点
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(testMessage)
      );

      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user?.username || 'Unknown',
        status: 'success',
      });

      // 如果测试成功且当前状态不是active，更新为active
      if (subscription.status !== 'active') {
        await updateSubScription(subscription.id, subscription.userid, { status: 'active' });
      }
    } catch (error: any) {
      notificationResults.push({
        userId: subscription.userid,
        username: subscription.user?.username || 'Unknown',
        status: 'failed',
        error: error.message || 'Unknown error',
      });

      // 如果测试失败，更新状态为inactive
      await updateSubScription(subscription.id, subscription.userid, { status: 'inactive' });
    }
  }

  return {
    totalNotified: subscriptions.length,
    results: notificationResults,
    summary: {
      success: notificationResults.filter((r) => r.status === 'success').length,
      failed: notificationResults.filter((r) => r.status === 'failed').length,
    },
  };
}
