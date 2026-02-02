import { desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { openKeyUsageLogs, userOpenKeys } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 使用日志数据类型
export interface UsageLogData {
  endpoint: string;
  method: string;
  clientIp?: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  errorMessage?: string;
}

// API密钥相关方法
export async function generateOpenKey(userid: string): Promise<any> {
  try {
    const [openKey] = await db
      .insert(userOpenKeys)
      .values({
        // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
        // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
        permissions: ['SENDROTE'],
        userid,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .returning();
    return openKey;
  } catch (error) {
    throw new DatabaseError('Failed to generate open key', error);
  }
}

export async function getMyOpenKey(userid: string): Promise<any> {
  try {
    const openKeys = await db.select().from(userOpenKeys).where(eq(userOpenKeys.userid, userid));
    return openKeys;
  } catch (error) {
    throw new DatabaseError('Failed to get user open keys', error);
  }
}

// 获取用户所有 OpenKey 带统计（动态计算）
export async function getMyOpenKeysWithStats(userid: string): Promise<any> {
  try {
    const openKeys = await db
      .select({
        ...getTableColumns(userOpenKeys),
        usageCount:
          sql<number>`(SELECT COUNT(*) FROM open_key_usage_logs WHERE open_key_usage_logs."openKeyId" = user_open_keys.id)`.as(
            'usageCount'
          ),
        lastUsedAt:
          sql<Date>`(SELECT MAX("createdAt") FROM open_key_usage_logs WHERE open_key_usage_logs."openKeyId" = user_open_keys.id)`.as(
            'lastUsedAt'
          ),
      })
      .from(userOpenKeys)
      .where(eq(userOpenKeys.userid, userid));
    return openKeys;
  } catch (error) {
    throw new DatabaseError('Failed to get user open keys with stats', error);
  }
}

export async function deleteMyOneOpenKey(userid: string, id: string): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to delete this open key');
    }

    const [result] = await db.delete(userOpenKeys).where(eq(userOpenKeys.id, id)).returning();
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to delete open key: ${id}`, error);
  }
}

export async function editMyOneOpenKey(
  userid: string,
  id: string,
  permissions: string[]
): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to edit this open key');
    }

    const [result] = await db
      .update(userOpenKeys)
      .set({ permissions, updatedAt: new Date() })
      .where(eq(userOpenKeys.id, id))
      .returning();
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update open key: ${id}`, error);
  }
}

export async function getOneOpenKey(id: string): Promise<any> {
  try {
    const [openKey] = await db.select().from(userOpenKeys).where(eq(userOpenKeys.id, id)).limit(1);

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    return openKey;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get open key: ${id}`, error);
  }
}

// 记录 OpenKey 使用日志
export async function logOpenKeyUsage(openKeyId: string, data: UsageLogData): Promise<void> {
  try {
    await db.insert(openKeyUsageLogs).values({
      openKeyId,
      endpoint: data.endpoint,
      method: data.method,
      clientIp: data.clientIp,
      userAgent: data.userAgent,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      errorMessage: data.errorMessage,
    });
  } catch (error) {
    console.error('Failed to log open key usage:', error);
  }
}

// 获取 OpenKey 使用日志（分页）
export async function getOpenKeyUsageLogs(openKeyId: string, limit = 50, skip = 0): Promise<any[]> {
  try {
    return await db
      .select()
      .from(openKeyUsageLogs)
      .where(eq(openKeyUsageLogs.openKeyId, openKeyId))
      .orderBy(desc(openKeyUsageLogs.createdAt))
      .limit(limit)
      .offset(skip);
  } catch (error) {
    throw new DatabaseError('Failed to get open key usage logs', error);
  }
}
