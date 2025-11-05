import prisma from '../prisma';
import { DatabaseError } from './common';

// 站点相关方法
export async function getSiteMapData(): Promise<any> {
  try {
    const users = await prisma.user.findMany({
      select: {
        username: true,
        nickname: true,
      },
    });
    return users;
  } catch (error) {
    throw new DatabaseError('Failed to get sitemap data', error);
  }
}

export async function getStatus(): Promise<boolean> {
  try {
    await prisma.rote.findFirst();
    return true;
  } catch (error) {
    throw new DatabaseError('Failed to check database status', error);
  }
}
