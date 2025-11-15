import prisma from '../prisma';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

// 笔记相关方法
export async function createRote(data: any): Promise<any> {
  try {
    const rote = await prisma.rote.create({
      data,
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: [{ sortIndex: 'asc' } as any, { createdAt: 'asc' }],
        },
        reactions: true,
      },
    });

    // 记录变更历史
    try {
      await createRoteChange({
        originid: rote.id,
        roteid: rote.id,
        action: 'CREATE',
        userid: rote.authorid,
      });
    } catch (error) {
      // 记录变更失败不影响创建操作，只记录错误
      console.error('Failed to record rote change for create:', error);
    }

    return rote;
  } catch (error) {
    throw new DatabaseError('Failed to create note', error);
  }
}

export async function findRoteById(id: string): Promise<any> {
  try {
    const rote = await prisma.rote.findFirst({
      where: { id },
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: [{ sortIndex: 'asc' } as any, { createdAt: 'asc' }],
        },
        reactions: true,
      },
    });
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote by id: ${id}`, error);
  }
}

export async function findRotesByIds(ids: string[]): Promise<any[]> {
  try {
    if (!ids || ids.length === 0) {
      return [];
    }

    const rotes = await prisma.rote.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: [{ sortIndex: 'asc' } as any, { createdAt: 'asc' }],
        },
        reactions: true,
      },
    });
    return rotes;
  } catch (error) {
    throw new DatabaseError(`Failed to find rotes by ids: ${ids.join(',')}`, error);
  }
}

export async function editRote(data: any): Promise<any> {
  try {
    const { id, authorid, reactions, author, attachments, ...cleanData } = data;
    const rote = await prisma.rote.update({
      where: {
        id: data.id,
        authorid: data.authorid,
      },
      data: cleanData,
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: [{ sortIndex: 'asc' } as any, { createdAt: 'asc' }],
        },
        reactions: true,
      },
    });

    // 记录变更历史
    try {
      await createRoteChange({
        originid: rote.id,
        roteid: rote.id,
        action: 'UPDATE',
        userid: rote.authorid,
      });
    } catch (error) {
      // 记录变更失败不影响更新操作，只记录错误
      console.error('Failed to record rote change for update:', error);
    }

    return rote;
  } catch (error) {
    console.error(`Error updating rote: ${data.id}`, error);

    throw new DatabaseError(`Failed to update rote: ${data.id}`, error);
  }
}

export async function deleteRote(data: any): Promise<any> {
  try {
    // 在删除前记录变更历史（确保 roteid 存在）
    try {
      await createRoteChange({
        originid: data.id,
        roteid: data.id,
        action: 'DELETE',
        userid: data.authorid,
      });
    } catch (error) {
      // 记录变更失败不影响删除操作，只记录错误
      console.error('Failed to record rote change for delete:', error);
    }

    const rote = await prisma.rote.delete({
      where: {
        id: data.id,
        authorid: data.authorid,
      },
    });
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to delete rote: ${data.id}`, error);
  }
}

export async function findMyRote(
  authorid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [
          {
            authorid,
            archived,
          },
          { ...filter },
        ],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: 'desc' }, { createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to find user rotes', error);
  }
}

export async function findUserPublicRote(
  userid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [
          {
            authorid: userid,
            archived,
            state: 'public',
          },
          { ...filter },
        ],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: 'desc' }, { createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to find public rotes', error);
  }
}

export async function findPublicRote(
  skip: number | undefined,
  limit: number | undefined,
  filter: any
): Promise<any> {
  try {
    const rotes = await prisma.rote.findMany({
      where: {
        AND: [{ state: 'public' }, { ...filter }],
      },
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to find public rotes', error);
  }
}

export async function findMyRandomRote(authorid: string): Promise<any> {
  try {
    const allCount = await prisma.rote.count({ where: { authorid } });
    if (allCount === 0) {
      throw new DatabaseError('No rotes found for user');
    }

    const random = Math.floor(Math.random() * allCount);
    const rote = await prisma.rote.findFirst({
      where: { authorid },
      skip: random,
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

    return rote;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to find random user rote', error);
  }
}

export async function findRandomPublicRote(): Promise<any> {
  try {
    const allCount = await prisma.rote.count({ where: { state: 'public' } });
    if (allCount === 0) {
      throw new DatabaseError('No public rotes found');
    }

    const random = Math.floor(Math.random() * allCount);
    const rote = await prisma.rote.findFirst({
      where: { state: 'public' },
      skip: random,
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

    return rote;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to find random public rote', error);
  }
}

export async function searchMyRotes(
  authorid: string,
  keyword: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any = {},
  archived: any = false
): Promise<any> {
  try {
    const searchFilter = {
      AND: [
        {
          authorid,
          archived,
        },
        {
          OR: [
            { content: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { tags: { hasSome: [keyword] } },
          ],
        },
        { ...filter },
      ],
    };

    const rotes = await prisma.rote.findMany({
      where: searchFilter,
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: 'desc' }, { createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to search user rotes', error);
  }
}

export async function searchPublicRotes(
  keyword: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any = {}
): Promise<any> {
  try {
    const searchFilter = {
      AND: [
        { state: 'public' },
        {
          OR: [
            { content: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { tags: { hasSome: [keyword] } },
          ],
        },
        { ...filter },
      ],
    };

    const rotes = await prisma.rote.findMany({
      where: searchFilter,
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to search public rotes', error);
  }
}

export async function searchUserPublicRotes(
  userid: string,
  keyword: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any = {},
  archived: any = false
): Promise<any> {
  try {
    const searchFilter = {
      AND: [
        {
          authorid: userid,
          archived,
          state: 'public',
        },
        {
          OR: [
            { content: { contains: keyword, mode: 'insensitive' } },
            { title: { contains: keyword, mode: 'insensitive' } },
            { tags: { hasSome: [keyword] } },
          ],
        },
        { ...filter },
      ],
    };

    const rotes = await prisma.rote.findMany({
      where: searchFilter,
      skip: skip ? skip : 0,
      take: limit ? limit : 20,
      orderBy: [{ pin: 'desc' }, { createdAt: 'desc' }],
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
    return rotes;
  } catch (error) {
    throw new DatabaseError('Failed to search user public rotes', error);
  }
}

export async function getRssData(
  username: string,
  limit = 20
): Promise<{ user: any; notes: any[] }> {
  try {
    // 先查找用户信息
    const user = await prisma.user.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        avatar: true,
        description: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 查找该用户的公开笔记
    const notes = await prisma.rote.findMany({
      where: {
        authorid: user.id,
        state: 'public',
        archived: false,
      },
      orderBy: {
        updatedAt: 'desc', // 按更新日期降序排序
      },
      take: limit,
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
      },
    });

    return { user, notes };
  } catch (error) {
    throw new DatabaseError('获取RSS数据失败', error);
  }
}

export async function getAllPublicRssData(limit = 20): Promise<{ notes: any[] }> {
  try {
    // 查找所有公开笔记
    const notes = await prisma.rote.findMany({
      where: {
        state: 'public',
        archived: false,
      },
      orderBy: {
        updatedAt: 'desc', // 按更新日期降序排序
      },
      take: limit,
      include: {
        author: {
          select: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
      },
    });

    return { notes };
  } catch (error) {
    throw new DatabaseError('获取所有公开笔记RSS数据失败', error);
  }
}
