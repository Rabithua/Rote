import { recordRoteChanges, type RoteChangeInput, type SyncTransaction } from '../../sync/journal';
import db from '../drizzle';
import { DatabaseError } from './common';

// RoteChange 相关方法
export async function createRoteChange(
  data: RoteChangeInput,
  transaction: SyncTransaction
): Promise<any> {
  try {
    const { userid, ...change } = data;
    const [roteChange] = await recordRoteChanges(transaction, userid, [change]);
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
      columns: { revision: false },
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
      columns: { revision: false },
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
      columns: { revision: false },
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
      columns: { revision: false },
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
