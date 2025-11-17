import prisma from '../prisma';
import { DatabaseError } from './common';

// RoteChange 相关方法
export async function createRoteChange(data: {
  originid: string;
  roteid?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userid: string;
}): Promise<any> {
  try {
    const roteChange = await prisma.roteChange.create({
      data: {
        originid: data.originid,
        roteid: data.roteid || data.originid,
        action: data.action,
        userid: data.userid,
      },
    });
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
    const where: any = { originid };
    if (userid) {
      where.userid = userid;
    }

    const roteChanges = await prisma.roteChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: limit,
      include: {
        rote: {
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return roteChanges;
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
    const where: any = { roteid };
    if (userid) {
      where.userid = userid;
    }

    const roteChanges = await prisma.roteChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: limit,
      include: {
        rote: {
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return roteChanges;
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
    const where: any = { userid };
    if (action) {
      where.action = action;
    }

    const roteChanges = await prisma.roteChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: limit,
      include: {
        rote: {
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return roteChanges;
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

    const where: any = {
      createdAt: {
        gt: timestampDate, // 使用 gt (greater than) 确保返回大于指定时间戳的记录
      },
    };

    if (userid) {
      where.userid = userid;
    }

    if (action) {
      where.action = action;
    }

    const roteChanges = await prisma.roteChange.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // 按时间升序，方便客户端按顺序处理
      skip: skip,
      take: limit,
      include: {
        rote: {
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            tags: true,
            state: true,
            archived: true,
            pin: true,
            editor: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return roteChanges;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote changes after timestamp: ${timestamp}`, error);
  }
}
