import crypto from 'crypto';
import prisma from '../prisma';
import { DatabaseError } from './common';

// 用户相关方法
export async function allUser() {
  try {
    const users = await prisma.user.findMany();
    return users;
  } catch (error: any) {
    throw new DatabaseError('Failed to get all users', error);
  }
}

export async function oneUser(id: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user;
  } catch (error) {
    throw new DatabaseError(`Failed to find user by id: ${id}`, error);
  }
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}) {
  try {
    let salt = crypto.randomBytes(16);
    let passwordhash = crypto.pbkdf2Sync(data.password, salt, 310000, 32, 'sha256');

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        nickname: data.nickname,
        passwordhash,
        salt,
      },
    });
    return user;
  } catch (error: any) {
    throw new DatabaseError('Failed to create user', error);
  }
}

export async function editMyProfile(userid: any, data: any): Promise<any> {
  try {
    const user = await prisma.user.update({
      where: { id: userid },
      data: {
        avatar: data.avatar || undefined,
        nickname: data.nickname || undefined,
        description: data.description || undefined,
        cover: data.cover || undefined,
      },
    });
    return user;
  } catch (error) {
    throw new DatabaseError('Failed to update user profile', error);
  }
}

export async function getUserInfoByUsername(username: string): Promise<any> {
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        avatar: true,
        cover: true,
        nickname: true,
        username: true,
        createdAt: true,
        description: true,
      },
    });

    if (!user) {
      throw new DatabaseError('User not found');
    }

    return user;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get user info: ${username}`, error);
  }
}

export async function changeUserPassword(
  oldpassword: string,
  newpassword: string,
  id: string
): Promise<any> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: id,
      },
    });

    if (!user) {
      throw new DatabaseError('User not found');
    }

    const passwordhash = user.passwordhash;
    const salt = user.salt;

    const oldpasswordhash = crypto.pbkdf2Sync(oldpassword, salt, 310000, 32, 'sha256');

    if (
      Buffer.from(oldpasswordhash).toString('hex') !== Buffer.from(passwordhash).toString('hex')
    ) {
      throw new DatabaseError('Incorrect old password');
    }

    const newSalt = crypto.randomBytes(16);
    const newpasswordhash = crypto.pbkdf2Sync(newpassword, newSalt, 310000, 32, 'sha256');

    const userUpdate = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordhash: newpasswordhash,
        salt: newSalt,
      },
    });

    return userUpdate;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to change password', error);
  }
}

export async function statistics(authorid: string): Promise<any> {
  try {
    const [noteCount, attachments] = await Promise.all([
      prisma.rote.count({ where: { authorid } }),
      prisma.attachment.findMany({ where: { userid: authorid } }),
    ]);

    return {
      noteCount,
      attachmentsCount: attachments.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user statistics', error);
  }
}

export async function exportData(authorid: string): Promise<any> {
  try {
    const notes = await prisma.rote.findMany({
      where: { authorid },
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return { notes };
  } catch (error) {
    throw new DatabaseError('Failed to export user data', error);
  }
}

export async function getHeatMap(userId: string, startDate: string, endDate: string): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        authorid: userId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    if (rotes.length === 0) {
      return {};
    }

    return rotes.reduce((acc: any, item: any) => {
      const date = item.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
  } catch (error) {
    throw new DatabaseError('Failed to generate heatmap data', error);
  }
}

export async function getMyTags(userid: string): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: { authorid: userid },
      select: { tags: true },
    });
    const allTags = Array.from(new Set(rotes.flatMap((item) => item.tags)));
    return allTags;
  } catch (error) {
    throw new DatabaseError('Failed to get user tags', error);
  }
}
