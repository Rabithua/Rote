import prisma from '../prisma';
import { DatabaseError } from './common';

// 订阅相关方法
export async function addSubScriptionToUser(userId: string, subScription: any): Promise<any> {
  try {
    // 使用 upsert 来处理重复的 endpoint
    const subScriptionRespon = await prisma.userSwSubScription.upsert({
      where: {
        endpoint: subScription.endpoint,
      },
      update: {
        userid: userId,
        expirationTime: subScription.expirationTime,
        keys: {
          auth: subScription.keys.auth,
          p256dh: subScription.keys.p256dh,
        },
      },
      create: {
        userid: userId,
        endpoint: subScription.endpoint,
        expirationTime: subScription.expirationTime,
        keys: {
          auth: subScription.keys.auth,
          p256dh: subScription.keys.p256dh,
        },
      },
      select: { id: true },
    });
    return subScriptionRespon;
  } catch (error) {
    throw new DatabaseError('Failed to add subscription', error);
  }
}

export async function findSubScriptionToUser(subId: string): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { id: subId },
    });

    if (!subscription) {
      throw new DatabaseError('Subscription not found');
    }

    return subscription;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to find subscription: ${subId}`, error);
  }
}

export async function findSubScriptionToUserByUserId(userId: string): Promise<any> {
  try {
    const subscriptions = await prisma.userSwSubScription.findMany({
      where: { userid: userId },
    });

    if (!subscriptions) {
      throw new DatabaseError('Subscriptions not found');
    }

    return subscriptions;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to find subscriptions for user: ${userId}`, error);
  }
}

// 获取所有活跃的订阅 - 用于公开笔记通知
export async function findAllActiveSubscriptions(): Promise<any> {
  try {
    const subscriptions = await prisma.userSwSubScription.findMany({
      where: {
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    return subscriptions;
  } catch (error) {
    throw new DatabaseError('Failed to find all active subscriptions', error);
  }
}

export async function findSubScriptionToUserByendpoint(endpoint: string): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { endpoint },
      select: { id: true },
    });
    return subscription;
  } catch (error) {
    throw new DatabaseError('Failed to find subscription by endpoint', error);
  }
}

export async function deleteSubScription(subId: string): Promise<any> {
  try {
    const result = await prisma.userSwSubScription.delete({
      where: { id: subId },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Failed to delete subscription: ${subId}`, error);
  }
}

export async function updateSubScription(
  subId: string,
  userId: string,
  updateData: any
): Promise<any> {
  try {
    // 首先验证订阅是否存在且属于当前用户
    const existingSubscription = await prisma.userSwSubScription.findUnique({
      where: { id: subId },
    });

    if (!existingSubscription) {
      throw new DatabaseError('Subscription not found');
    }

    if (existingSubscription.userid !== userId) {
      throw new DatabaseError('User does not match');
    }

    // 准备更新数据
    const updateFields: any = {};

    if (updateData.endpoint) {
      updateFields.endpoint = updateData.endpoint;
    }

    if (updateData.expirationTime !== undefined) {
      updateFields.expirationTime = updateData.expirationTime;
    }

    if (updateData.status) {
      updateFields.status = updateData.status;
    }

    if (updateData.note !== undefined) {
      updateFields.note = updateData.note;
    }

    if (updateData.keys) {
      updateFields.keys = {
        auth: updateData.keys.auth,
        p256dh: updateData.keys.p256dh,
      };
    }

    const result = await prisma.userSwSubScription.update({
      where: { id: subId },
      data: updateFields,
    });

    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update subscription: ${subId}`, error);
  }
}
