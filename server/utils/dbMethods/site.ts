import { rotes, users } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

// 站点相关方法
export async function getSiteMapData(): Promise<any> {
  try {
    const usersList = await db
      .select({
        username: users.username,
        nickname: users.nickname,
      })
      .from(users);
    return usersList;
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
