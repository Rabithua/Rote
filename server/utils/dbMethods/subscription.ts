import { eq, sql } from 'drizzle-orm';
import { userSwSubscriptions } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 订阅相关方法
export async function addSubScriptionToUser(userId: string, subScription: any): Promise<any> {
  try {
    // 先尝试查找现有订阅
    const [existing] = await db
      .select()
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.endpoint, subScription.endpoint))
      .limit(1);

    if (existing) {
      // 更新现有订阅
      const [updated] = await db
        .update(userSwSubscriptions)
        .set({
          userid: userId,
          expirationTime: subScription.expirationTime || null,
          keys: {
            auth: subScription.keys.auth,
            p256dh: subScription.keys.p256dh,
          },
          updatedAt: new Date(),
        })
        .where(eq(userSwSubscriptions.endpoint, subScription.endpoint))
        .returning({ id: userSwSubscriptions.id });
      return updated;
    } else {
      // 创建新订阅
      const [created] = await db
        .insert(userSwSubscriptions)
        .values({
          // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
          // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
          userid: userId,
          endpoint: subScription.endpoint,
          expirationTime: subScription.expirationTime || null,
          keys: {
            auth: subScription.keys.auth,
            p256dh: subScription.keys.p256dh,
          },
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .returning({ id: userSwSubscriptions.id });
      return created;
    }
  } catch (error) {
    throw new DatabaseError('Failed to add subscription', error);
  }
}

export async function findSubScriptionToUser(subId: string): Promise<any> {
  try {
    const [subscription] = await db
      .select()
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.id, subId))
      .limit(1);

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
    const subscriptions = await db
      .select()
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.userid, userId));

    if (!subscriptions || subscriptions.length === 0) {
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
    const subscriptions = await db.query.userSwSubscriptions.findMany({
      where: (userSwSubscriptions, { eq }) => eq(userSwSubscriptions.status, 'active'),
      with: {
        user: {
          columns: {
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
    const [subscription] = await db
      .select({ id: userSwSubscriptions.id })
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.endpoint, endpoint))
      .limit(1);
    return subscription || null;
  } catch (error) {
    throw new DatabaseError('Failed to find subscription by endpoint', error);
  }
}

export async function deleteSubScription(subId: string): Promise<any> {
  try {
    const [result] = await db
      .delete(userSwSubscriptions)
      .where(eq(userSwSubscriptions.id, subId))
      .returning();
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
    const [existingSubscription] = await db
      .select()
      .from(userSwSubscriptions)
      .where(eq(userSwSubscriptions.id, subId))
      .limit(1);

    if (!existingSubscription) {
      throw new DatabaseError('Subscription not found');
    }

    if (existingSubscription.userid !== userId) {
      throw new DatabaseError('User does not match');
    }

    // 准备更新数据
    const updateFields: any = { updatedAt: new Date() };

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

    const [result] = await db
      .update(userSwSubscriptions)
      .set(updateFields)
      .where(eq(userSwSubscriptions.id, subId))
      .returning();

    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update subscription: ${subId}`, error);
  }
}
