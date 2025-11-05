import prisma from '../prisma';
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
    return reaction;
  } catch (error) {
    throw new DatabaseError('Failed to remove reaction', error);
  }
}
