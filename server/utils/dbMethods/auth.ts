import prisma from '../prisma';
import { DatabaseError } from './common';

// 认证相关方法
export async function passportCheckUser(data: { username: string }) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        username: data.username,
      },
    });
    return {
      err: null,
      user: user,
    };
  } catch (error) {
    throw new DatabaseError('Failed to authenticate user', error);
  }
}
