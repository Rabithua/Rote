import { and, eq, isNull, sql } from 'drizzle-orm';
import { reactions, rotes } from '../../drizzle/schema';
import { isPushNotificationsEnabled } from '../../push/config';
import { enqueueAggregatedReactionPushEventInTransaction } from '../../push/repository';
import db from '../drizzle';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

type ReactionIdentity = {
  type: string;
  roteid: string;
  userid?: string;
  visitorId?: string;
};

function reactionLockKey(data: ReactionIdentity): string {
  const actorKey = data.userid ? `user:${data.userid}` : `visitor:${data.visitorId ?? ''}`;
  return `reaction:${data.roteid}:${data.type}:${actorKey}`;
}

function reactionIdentity(data: ReactionIdentity) {
  return and(
    eq(reactions.type, data.type),
    eq(reactions.roteid, data.roteid),
    data.userid ? eq(reactions.userid, data.userid) : isNull(reactions.userid),
    data.visitorId ? eq(reactions.visitorId, data.visitorId) : isNull(reactions.visitorId)
  );
}

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
    const insertedReaction = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${reactionLockKey(data)}))`
      );
      const [existing] = await transaction
        .select({ id: reactions.id })
        .from(reactions)
        .where(reactionIdentity(data))
        .limit(1);
      const reactionValues = {
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
      };
      const [inserted] = existing
        ? await transaction
            .update(reactions)
            .set({
              updatedAt: sql`now()`,
              visitorInfo: data.visitorInfo || null,
              metadata: data.metadata || null,
            })
            .where(eq(reactions.id, existing.id))
            .returning()
        : await transaction.insert(reactions).values(reactionValues).returning();
      if (!existing && isPushNotificationsEnabled()) {
        const [rote] = await transaction
          .select({ id: rotes.id, authorid: rotes.authorid })
          .from(rotes)
          .where(eq(rotes.id, data.roteid))
          .limit(1);
        if (rote && rote.authorid !== data.userid) {
          await enqueueAggregatedReactionPushEventInTransaction(transaction, {
            userid: rote.authorid,
            roteId: rote.id,
          });
        }
      }
      return inserted;
    });

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
    const result = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${reactionLockKey(data)}))`
      );
      return await transaction.delete(reactions).where(reactionIdentity(data)).returning();
    });

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
