import { asc, eq, inArray, sql } from 'drizzle-orm';
import { roteComments } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

type CommentWithUser = {
  id: string;
  roteid: string;
  userid: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    username: string;
    nickname: string | null;
    avatar: string | null;
  } | null;
  children?: CommentWithUser[];
};

function buildCommentTree(comments: CommentWithUser[]): CommentWithUser[] {
  const map = new Map<string, CommentWithUser>();
  const roots: CommentWithUser[] = [];

  comments.forEach((comment) => {
    comment.children = [];
    map.set(comment.id, comment);
  });

  comments.forEach((comment) => {
    if (comment.parentId && map.has(comment.parentId)) {
      map.get(comment.parentId)?.children?.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

export async function createRoteComment(data: {
  roteid: string;
  userid: string;
  content: string;
  parentId?: string | null;
}): Promise<CommentWithUser> {
  try {
    const [comment] = await db
      .insert(roteComments)
      .values({
        roteid: data.roteid,
        userid: data.userid,
        content: data.content,
        parentId: data.parentId ?? null,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to insert comment: no data returned');
    }

    const commentWithUser = await db.query.roteComments.findFirst({
      where: (comments, { eq }) => eq(comments.id, comment.id),
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

    return (commentWithUser as CommentWithUser) || (comment as CommentWithUser);
  } catch (error) {
    throw new DatabaseError('Failed to create comment', error);
  }
}

export async function getRoteCommentsByRoteId(roteid: string): Promise<CommentWithUser[]> {
  try {
    const comments = await db.query.roteComments.findMany({
      where: (comments, { eq }) => eq(comments.roteid, roteid),
      orderBy: (comments, { asc }) => [asc(comments.createdAt)],
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

    return buildCommentTree(comments as CommentWithUser[]);
  } catch (error) {
    throw new DatabaseError('Failed to get comments', error);
  }
}

export async function getRoteCommentById(id: string): Promise<CommentWithUser | null> {
  try {
    const comment = await db.query.roteComments.findFirst({
      where: (comments, { eq }) => eq(comments.id, id),
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
    return (comment as CommentWithUser) || null;
  } catch (error) {
    throw new DatabaseError(`Failed to find comment by id: ${id}`, error);
  }
}

export async function getRoteCommentCount(roteid: string): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(roteComments)
      .where(eq(roteComments.roteid, roteid));

    return Number(rows[0]?.count || 0);
  } catch (error) {
    throw new DatabaseError('Failed to get comment count', error);
  }
}

export async function getRoteCommentCounts(roteids: string[]): Promise<Record<string, number>> {
  try {
    if (!roteids.length) return {};

    const rows = await db
      .select({
        roteid: roteComments.roteid,
        count: sql<number>`count(*)`,
      })
      .from(roteComments)
      .where(inArray(roteComments.roteid, roteids))
      .groupBy(roteComments.roteid);

    const map: Record<string, number> = {};
    rows.forEach((row) => {
      map[row.roteid] = Number(row.count || 0);
    });

    return map;
  } catch (error) {
    throw new DatabaseError('Failed to get comment counts', error);
  }
}

export async function deleteRoteComment(id: string): Promise<CommentWithUser | null> {
  try {
    const [comment] = await db.delete(roteComments).where(eq(roteComments.id, id)).returning();
    return (comment as CommentWithUser) || null;
  } catch (error) {
    throw new DatabaseError(`Failed to delete comment: ${id}`, error);
  }
}
