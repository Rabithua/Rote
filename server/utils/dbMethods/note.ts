import { and, count, eq } from 'drizzle-orm';
import { rotes, users } from '../../drizzle/schema';
import db from '../drizzle';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

// 笔记相关方法
export async function createRote(data: any): Promise<any> {
  try {
    const {
      id: _id,
      author: _author,
      attachments: _attachments,
      reactions: _reactions,
      changes: _changes,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...cleanData
    } = data;

    // 确保 tags 字段是数组，不能是 undefined 或 null
    if (cleanData.tags === undefined || cleanData.tags === null) {
      cleanData.tags = [];
    }

    // 处理其他有默认值的字段
    // title 默认值为空字符串
    if (cleanData.title === undefined || cleanData.title === null) {
      cleanData.title = '';
    }

    // state 默认值为 'private'，且不能为 null
    if (cleanData.state === undefined || cleanData.state === null) {
      cleanData.state = 'private';
    }

    // pin 默认值为 false，且不能为 null
    if (cleanData.pin === undefined || cleanData.pin === null) {
      cleanData.pin = false;
    }

    // archived 默认值为 false
    if (cleanData.archived === undefined || cleanData.archived === null) {
      cleanData.archived = false;
    }

    // 确保不包含 id 字段，让数据库使用 sql`gen_random_uuid()` 自动生成
    delete cleanData.id;

    // 移除所有 undefined 字段，让数据库使用默认值
    // 但保留 null 值，因为某些字段可能需要显式设置为 null
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === undefined) {
        delete cleanData[key];
      }
    });

    // 不传递 id 字段，让数据库使用 schema 中定义的 defaultRandom() 自动生成
    // 根据 Drizzle 文档，这是推荐的做法
    console.log('Inserting rote with data:', JSON.stringify(cleanData, null, 2));
    const [rote] = await db.insert(rotes).values(cleanData).returning();
    console.log('Inserted rote:', rote?.id);

    if (!rote) {
      throw new Error('Failed to insert rote: no data returned');
    }

    // 使用 relational query API 获取关联数据
    let roteWithRelations;
    try {
      roteWithRelations = await db.query.rotes.findFirst({
        where: (rotes, { eq }) => eq(rotes.id, rote.id),
        with: {
          author: {
            columns: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          attachments: {
            orderBy: (attachments, { asc }) => [
              asc(attachments.sortIndex),
              asc(attachments.createdAt),
            ],
          },
          reactions: true,
        },
      });
    } catch (queryError) {
      // 如果关联查询失败，至少返回插入的数据
      console.error('Failed to fetch rote with relations:', queryError);
      roteWithRelations = rote;
    }

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

    return roteWithRelations;
  } catch (error: any) {
    // 始终打印详细错误信息以便调试
    console.error('Failed to create note - original error:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('Data passed to createRote:', JSON.stringify(data, null, 2));
    throw new DatabaseError('Failed to create note', error);
  }
}

export async function findRoteById(id: string): Promise<any> {
  try {
    const rote = await db.query.rotes.findFirst({
      where: (rotes, { eq }) => eq(rotes.id, id),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        reactions: true,
      },
    });
    return rote || null;
  } catch (error) {
    throw new DatabaseError(`Failed to find rote by id: ${id}`, error);
  }
}

export async function findRotesByIds(ids: string[]): Promise<any[]> {
  try {
    if (!ids || ids.length === 0) {
      return [];
    }

    const rotesList = await db.query.rotes.findMany({
      where: (rotes, { inArray }) => inArray(rotes.id, ids),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        reactions: true,
      },
    });
    return rotesList;
  } catch (error) {
    throw new DatabaseError(`Failed to find rotes by ids: ${ids.join(',')}`, error);
  }
}

export async function editRote(data: any): Promise<any> {
  try {
    const {
      id: _id,
      authorid: _authorid,
      reactions: _reactions,
      author: _author,
      attachments: _attachments,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...cleanData
    } = data;

    // 确保 updatedAt 是 Date 对象，且由服务器端控制
    cleanData.updatedAt = new Date();

    const [rote] = await db
      .update(rotes)
      .set(cleanData)
      .where(and(eq(rotes.id, data.id), eq(rotes.authorid, data.authorid)))
      .returning();

    // 使用 relational query API 获取关联数据
    const roteWithRelations = await db.query.rotes.findFirst({
      where: (rotes, { eq }) => eq(rotes.id, rote.id),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
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

    return roteWithRelations;
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

    const [rote] = await db
      .delete(rotes)
      .where(and(eq(rotes.id, data.id), eq(rotes.authorid, data.authorid)))
      .returning();
    return rote;
  } catch (error) {
    throw new DatabaseError(`Failed to delete rote: ${data.id}`, error);
  }
}

// 构建过滤条件的辅助函数（用于 relational query API）
function buildWhereConditions(
  authorid: string | undefined,
  archived: any,
  state: string | undefined,
  filter: any
) {
  return (rotes: any, { eq, and }: any) => {
    const conditions = [];
    if (authorid) {
      conditions.push(eq(rotes.authorid, authorid));
    }
    if (archived !== undefined) {
      conditions.push(eq(rotes.archived, archived));
    }
    if (state) {
      conditions.push(eq(rotes.state, state));
    }

    // 处理额外的过滤条件
    if (filter && typeof filter === 'object') {
      Object.keys(filter).forEach((key) => {
        if (filter[key] !== undefined && filter[key] !== null) {
          // 跳过 Prisma 特定的过滤格式（如 hasEvery），这些在 Drizzle 中需要特殊处理
          if (key === 'tags' && filter[key]?.hasEvery) {
            return;
          }
          conditions.push(eq(rotes[key], filter[key]));
        }
      });
    }

    if (conditions.length === 0) {
      // 如果没有条件，返回一个总是为 true 的条件（或者根据 authorid 返回）
      return authorid ? eq(rotes.authorid, authorid) : undefined;
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  };
}

export async function findMyRote(
  authorid: string,
  skip: number | undefined,
  limit: number | undefined,
  filter: any,
  archived: any
): Promise<any> {
  try {
    const whereCondition = buildWhereConditions(authorid, archived, undefined, filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.pin), desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
  } catch (error: any) {
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
    const whereCondition = buildWhereConditions(userid, archived, 'public', filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.pin), desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
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
    const whereCondition = buildWhereConditions(undefined, false, 'public', filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
  } catch (error) {
    throw new DatabaseError('Failed to find public rotes', error);
  }
}

export async function findMyRandomRote(authorid: string): Promise<any> {
  try {
    const [countResult] = await db
      .select({ count: count() })
      .from(rotes)
      .where(eq(rotes.authorid, authorid));

    const allCount = countResult?.count || 0;

    if (allCount === 0) {
      return null;
    }

    const random = Math.floor(Math.random() * allCount);

    const rotesList = await db.query.rotes.findMany({
      where: (rotes, { eq }) => eq(rotes.authorid, authorid),
      offset: random,
      limit: 1,
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return rotesList[0] || null;
  } catch (error: any) {
    throw new DatabaseError('Failed to find random user rote', error);
  }
}

export async function findRandomPublicRote(): Promise<any> {
  try {
    const [countResult] = await db
      .select({ count: count() })
      .from(rotes)
      .where(eq(rotes.state, 'public'));

    const allCount = countResult?.count || 0;
    if (allCount === 0) {
      throw new DatabaseError('No public rotes found');
    }

    const random = Math.floor(Math.random() * allCount);
    const rotesList = await db.query.rotes.findMany({
      where: (rotes, { eq }) => eq(rotes.state, 'public'),
      offset: random,
      limit: 1,
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return rotesList[0] || null;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError('Failed to find random public rote', error);
  }
}

// 构建搜索条件的辅助函数（用于 relational query API）
function buildSearchConditions(
  keyword: string,
  authorid: string | undefined,
  archived: any,
  state: string | undefined,
  filter: any
) {
  return (rotes: any, { eq, and, or, ilike, sql }: any) => {
    const searchConditions = [
      ilike(rotes.content, `%${keyword}%`),
      ilike(rotes.title, `%${keyword}%`),
      sql`${rotes.tags} @> ARRAY[${keyword}]::text[]`,
    ];

    const conditions = [or(...searchConditions)];

    if (authorid) conditions.push(eq(rotes.authorid, authorid));
    if (archived !== undefined) conditions.push(eq(rotes.archived, archived));
    if (state) conditions.push(eq(rotes.state, state));

    // 处理额外的过滤条件
    if (filter && typeof filter === 'object') {
      Object.keys(filter).forEach((key) => {
        if (filter[key] !== undefined && filter[key] !== null) {
          conditions.push(eq(rotes[key], filter[key]));
        }
      });
    }

    return and(...conditions);
  };
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
    const whereCondition = buildSearchConditions(keyword, authorid, archived, undefined, filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.pin), desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
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
    const whereCondition = buildSearchConditions(keyword, undefined, false, 'public', filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
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
    const whereCondition = buildSearchConditions(keyword, userid, archived, 'public', filter);

    const rotesList = await db.query.rotes.findMany({
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes, { desc }) => [desc(rotes.pin), desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });
    return rotesList;
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
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        avatar: users.avatar,
        description: users.description,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new Error('用户不存在');
    }

    // 查找该用户的公开笔记
    const notes = await db.query.rotes.findMany({
      where: (rotes, { eq, and }) =>
        and(eq(rotes.authorid, user.id), eq(rotes.state, 'public'), eq(rotes.archived, false)),
      orderBy: (rotes, { desc }) => [desc(rotes.updatedAt)],
      limit: limit,
      with: {
        author: {
          columns: {
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
    const notes = await db.query.rotes.findMany({
      where: (rotes, { eq, and }) => and(eq(rotes.state, 'public'), eq(rotes.archived, false)),
      orderBy: (rotes, { desc }) => [desc(rotes.updatedAt)],
      limit: limit,
      with: {
        author: {
          columns: {
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
