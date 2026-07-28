import { and, asc, desc, eq, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { userBlocks, users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

export interface UserBlockRelationship {
  viewerHasBlocked: boolean;
  targetHasBlocked: boolean;
}

export interface BlockedUserSummary {
  id: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  description: string | null;
  certified: boolean;
  blockedAt: Date;
}

export async function createUserBlock(blockerId: string, blockedId: string): Promise<void> {
  try {
    await db
      .insert(userBlocks)
      .values({ blockerId, blockedId })
      .onConflictDoNothing({
        target: [userBlocks.blockerId, userBlocks.blockedId],
      });
  } catch (error) {
    throw new DatabaseError('Failed to block user', error);
  }
}

export async function deleteUserBlock(blockerId: string, blockedId: string): Promise<void> {
  try {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  } catch (error) {
    throw new DatabaseError('Failed to unblock user', error);
  }
}

export async function listUserBlocks(blockerId: string): Promise<BlockedUserSummary[]> {
  try {
    return await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        description: users.description,
        certified: users.emailVerified,
        blockedAt: userBlocks.createdAt,
      })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, blockerId))
      .orderBy(desc(userBlocks.createdAt), asc(userBlocks.blockedId));
  } catch (error) {
    throw new DatabaseError('Failed to list blocked users', error);
  }
}

export async function hasUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const [relationship] = await db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);
    return Boolean(relationship);
  } catch (error) {
    throw new DatabaseError('Failed to check user block relationship', error);
  }
}

export async function getUserBlockRelationship(
  viewerId: string,
  targetId: string
): Promise<UserBlockRelationship> {
  try {
    const relationships = await db
      .select({
        blockerId: userBlocks.blockerId,
        blockedId: userBlocks.blockedId,
      })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, targetId)),
          and(eq(userBlocks.blockerId, targetId), eq(userBlocks.blockedId, viewerId))
        )
      );

    return {
      viewerHasBlocked: relationships.some(
        ({ blockerId, blockedId }) => blockerId === viewerId && blockedId === targetId
      ),
      targetHasBlocked: relationships.some(
        ({ blockerId, blockedId }) => blockerId === targetId && blockedId === viewerId
      ),
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user block relationship', error);
  }
}

export async function hasBlockInEitherDirection(
  userId: string,
  targetId: string
): Promise<boolean> {
  const relationship = await getUserBlockRelationship(userId, targetId);
  return relationship.viewerHasBlocked || relationship.targetHasBlocked;
}

/**
 * SQL predicate used by viewer-aware content queries. It must be included in
 * the database WHERE clause before offset/limit are applied.
 */
export function subjectIsVisibleToViewer(
  subjectId: SQLWrapper,
  viewerId?: string
): SQL | undefined {
  if (!viewerId) return undefined;

  return sql`NOT EXISTS (
    SELECT 1
    FROM "user_blocks" AS viewer_blocks
    WHERE (
      (viewer_blocks."blockerId" = ${viewerId} AND viewer_blocks."blockedId" = ${subjectId})
      OR
      (viewer_blocks."blockerId" = ${subjectId} AND viewer_blocks."blockedId" = ${viewerId})
    )
  )`;
}

/**
 * Anonymous reactions stay public. Named reactions are hidden when the viewer
 * and reacting account have a block in either direction.
 */
export function reactionIsVisibleToViewer(
  reactionUserId: SQLWrapper,
  viewerId?: string
): SQL | undefined {
  if (!viewerId) return undefined;
  const userVisible = subjectIsVisibleToViewer(reactionUserId, viewerId);
  return sql`(${reactionUserId} IS NULL OR ${userVisible})`;
}
