import { and, eq, sql } from 'drizzle-orm';
import { reactions, rotes } from '../../drizzle/schema';
import db from '../drizzle';
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
    const [insertedReaction] = await db
      .insert(reactions)
      .values({
        // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
        // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
        type: data.type,
        roteid: data.roteid,
        userid: data.userid || null,
        visitorId: data.visitorId || null,
        visitorInfo: data.visitorInfo || null,
        metadata: data.metadata || null,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [reactions.userid, reactions.visitorId, reactions.roteid, reactions.type],
        set: {
          updatedAt: sql`now()`,
          visitorInfo: data.visitorInfo || null,
          metadata: data.metadata || null,
        },
      })
      .returning();

    // 查询带用户信息的完整记录
    const reaction = await db.query.reactions.findFirst({
      where: (reactions, { eq }) => eq(reactions.id, insertedReaction.id),
      with: {
        user: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    // 记录变更历史（reactions 变化视为笔记更新）
    try {
      const [rote] = await db
        .select({ id: rotes.id, authorid: rotes.authorid })
        .from(rotes)
        .where(eq(rotes.id, data.roteid))
        .limit(1);
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
    const whereConditions = [eq(reactions.type, data.type), eq(reactions.roteid, data.roteid)];

    if (data.userid) {
      whereConditions.push(eq(reactions.userid, data.userid));
    } else if (data.visitorId) {
      whereConditions.push(eq(reactions.visitorId, data.visitorId));
    }

    const result = await db
      .delete(reactions)
      .where(and(...whereConditions))
      .returning();

    // 记录变更历史（reactions 变化视为笔记更新）
    // 只有在成功删除反应时才记录（count > 0）
    if (result.length > 0) {
      try {
        const [rote] = await db
          .select({ id: rotes.id, authorid: rotes.authorid })
          .from(rotes)
          .where(eq(rotes.id, data.roteid))
          .limit(1);
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

    return { count: result.length };
  } catch (error) {
    throw new DatabaseError('Failed to remove reaction', error);
  }
}
