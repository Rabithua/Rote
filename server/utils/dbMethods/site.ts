import { and, eq } from 'drizzle-orm';
import { rotes, users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

export interface SitemapUser {
  username: string;
  nickname: string | null;
  updatedAt: Date | null;
}

export interface SitemapNote {
  id: string;
  updatedAt: Date | null;
  authorUsername: string;
}

export interface SitemapData {
  users: SitemapUser[];
  notes: SitemapNote[];
}

// 站点相关方法
export async function getSiteMapData(): Promise<SitemapData> {
  try {
    const usersList = await db
      .select({
        username: users.username,
        nickname: users.nickname,
        updatedAt: users.updatedAt,
      })
      .from(users);

    const publicNotes = await db
      .select({
        id: rotes.id,
        updatedAt: rotes.updatedAt,
        authorUsername: users.username,
      })
      .from(rotes)
      .innerJoin(users, eq(rotes.authorid, users.id))
      .where(and(eq(rotes.state, 'public'), eq(rotes.archived, false)));

    return { users: usersList, notes: publicNotes };
  } catch (error) {
    throw new DatabaseError('Failed to get sitemap data', error);
  }
}

export async function getStatus(): Promise<boolean> {
  try {
    await db.select().from(rotes).limit(1);
    return true;
  } catch (error) {
    throw new DatabaseError('Failed to check database status', error);
  }
}
