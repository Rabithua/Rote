import { sql } from 'drizzle-orm';
import { roteChanges } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// RoteChange 相关方法
export async function createRoteChange(data: {
  originid: string;
  roteid?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userid: string;
}): Promise<any> {
  try {
    const [roteChange] = await db
      .insert(roteChanges)
      .values({
        // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
        // 使用 sql`now()` 让数据库原子性地计算时间戳
        // 注意：roteChanges 表只有 createdAt，没有 updatedAt
        originid: data.originid,
        roteid: data.roteid || data.originid,
        action: data.action,
        userid: data.userid,
        createdAt: sql`now()`,
      })
      .returning();
    return roteChange;
  } catch (error) {
    throw new DatabaseError('Failed to create rote change', error);
  }
}

export async function findRoteChangesByOriginId(
  originid: string,
  userid?: string,
  skip?: number,
  limit?: number
): Promise<any> {
  try {
    const changes = await db.query.roteChanges.findMany({
      where: (roteChanges, { eq, and }) => {
        const conditions = [eq(roteChanges.originid, originid)];
        if (userid) {
          conditions.push(eq(roteChanges.userid, userid));
        }
        return and(...conditions);
      },
      orderBy: (roteChanges, { desc }) => [desc(roteChanges.createdAt)],
      offset: skip,
      limit: limit,
      with: {
        rote: {
          columns: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            articleId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return changes;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote changes by originid: ${originid}`, error);
  }
}

export async function findRoteChangesByRoteId(
  roteid: string,
  userid?: string,
  skip?: number,
  limit?: number
): Promise<any> {
  try {
    const changes = await db.query.roteChanges.findMany({
      where: (roteChanges, { eq, and }) => {
        const conditions = [eq(roteChanges.roteid, roteid)];
        if (userid) {
          conditions.push(eq(roteChanges.userid, userid));
        }
        return and(...conditions);
      },
      orderBy: (roteChanges, { desc }) => [desc(roteChanges.createdAt)],
      offset: skip,
      limit: limit,
      with: {
        rote: {
          columns: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            articleId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return changes;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote changes by roteid: ${roteid}`, error);
  }
}

export async function findRoteChangesByUserId(
  userid: string,
  skip?: number,
  limit?: number,
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
): Promise<any> {
  try {
    const changes = await db.query.roteChanges.findMany({
      where: (roteChanges, { eq, and }) => {
        const conditions = [eq(roteChanges.userid, userid)];
        if (action) {
          conditions.push(eq(roteChanges.action, action));
        }
        return and(...conditions);
      },
      orderBy: (roteChanges, { desc }) => [desc(roteChanges.createdAt)],
      offset: skip,
      limit: limit,
      with: {
        rote: {
          columns: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            articleId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return changes;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote changes by userid: ${userid}`, error);
  }
}

export async function findRoteChangesAfterTimestamp(
  timestamp: Date | string,
  userid?: string,
  skip?: number,
  limit?: number,
  action?: 'CREATE' | 'UPDATE' | 'DELETE'
): Promise<any> {
  try {
    // 确保时间戳是 Date 对象
    const timestampDate = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    // 验证时间戳是否有效
    if (isNaN(timestampDate.getTime())) {
      throw new Error('Invalid timestamp');
    }

    const changes = await db.query.roteChanges.findMany({
      where: (roteChanges, { eq, and, gt }) => {
        const conditions = [gt(roteChanges.createdAt, timestampDate)];
        if (userid) {
          conditions.push(eq(roteChanges.userid, userid));
        }
        if (action) {
          conditions.push(eq(roteChanges.action, action));
        }
        return and(...conditions);
      },
      orderBy: (roteChanges, { asc }) => [asc(roteChanges.createdAt)], // 按时间升序，方便客户端按顺序处理
      offset: skip,
      limit: limit,
      with: {
        rote: {
          columns: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            articleId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return changes;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote changes after timestamp: ${timestamp}`, error);
  }
}
