import prisma from '../prisma';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

// 反应相关方法
export async function addReaction(data: {
  type: string;
  roteid: string;
  userid?: string;
  visitorId?: string;
  visitorInfo?: any;
  metadata?: any;
}): Promise<any> {
  try {
    const reaction = await prisma.reaction.create({
      data: {
        type: data.type,
        roteid: data.roteid,
        userid: data.userid,
        visitorId: data.visitorId,
        visitorInfo: data.visitorInfo,
        metadata: data.metadata,
      },
    });

    // 记录变更历史（reactions 变化视为笔记更新）
    try {
      const rote = await prisma.rote.findUnique({
        where: { id: data.roteid },
        select: { id: true, authorid: true },
      });
      if (rote) {
        await createRoteChange({
          originid: rote.id,
          roteid: rote.id,
          action: 'UPDATE',
          userid: rote.authorid,
        });
      }
    } catch (error) {
      // 记录变更失败不影响添加反应操作，只记录错误
      console.error('Failed to record rote change for add reaction:', error);
    }

    return reaction;
  } catch (error) {
    throw new DatabaseError('Failed to add reaction', error);
  }
}

export async function removeReaction(data: {
  type: string;
  roteid: string;
  userid?: string;
  visitorId?: string;
}): Promise<any> {
  try {
    const whereClause: any = {
      type: data.type,
      roteid: data.roteid,
    };

    if (data.userid) {
      whereClause.userid = data.userid;
    } else if (data.visitorId) {
      whereClause.visitorId = data.visitorId;
    }

    const reaction = await prisma.reaction.deleteMany({
      where: whereClause,
    });

    // 记录变更历史（reactions 变化视为笔记更新）
    // 只有在成功删除反应时才记录（count > 0）
    if (reaction.count > 0) {
      try {
        const rote = await prisma.rote.findUnique({
          where: { id: data.roteid },
          select: { id: true, authorid: true },
        });
        if (rote) {
          await createRoteChange({
            originid: rote.id,
            roteid: rote.id,
            action: 'UPDATE',
            userid: rote.authorid,
          });
        }
      } catch (error) {
        // 记录变更失败不影响删除反应操作，只记录错误
        console.error('Failed to record rote change for remove reaction:', error);
      }
    }

    return reaction;
  } catch (error) {
    throw new DatabaseError('Failed to remove reaction', error);
  }
}
