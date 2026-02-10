import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { rotes, users } from '../../drizzle/schema';
import type { SecurityConfig } from '../../types/config';
import { getGlobalConfig } from '../config';
import db from '../drizzle';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

// 文章查询配置常量
const ARTICLE_QUERY = {
  columns: {
    id: true,
    content: true,
    authorId: true,
    createdAt: true,
    updatedAt: true,
  },
};

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
    // 使用 sql`now()` 让数据库原子性地在同一时间点计算时间戳
    // 这确保 createdAt 和 updatedAt 完全一致
    const [rote] = await db
      .insert(rotes)
      .values({
        ...cleanData,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .returning();

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
              emailVerified: true,
            },
          },
          attachments: {
            orderBy: (attachments, { asc }) => [
              asc(attachments.sortIndex),
              asc(attachments.createdAt),
            ],
          },
          linkPreviews: {
            orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
          },
          reactions: {
            with: {
              user: {
                columns: {
                  username: true,
                  nickname: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    } catch (_queryError) {
      // 如果关联查询失败，至少返回插入的数据
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
    } catch (_error) {
      // 记录变更失败不影响创建操作，静默处理
    }

    return roteWithRelations;
  } catch (error: any) {
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
            emailVerified: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
            emailVerified: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
      },
    });
    return rotesList;
  } catch (error) {
    throw new DatabaseError(`Failed to find rotes by ids: ${ids.join(',')}`, error);
  }
}

export async function findRotesMetaByIds(
  ids: string[]
): Promise<Array<{ id: string; state: string; authorid: string }>> {
  try {
    if (!ids || ids.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        id: rotes.id,
        state: rotes.state,
        authorid: rotes.authorid,
      })
      .from(rotes)
      .where(inArray(rotes.id, ids));

    return rows;
  } catch (error) {
    throw new DatabaseError(`Failed to find rotes meta by ids: ${ids.join(',')}`, error);
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
            emailVerified: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
    } catch (_error) {
      // 记录变更失败不影响更新操作，静默处理
    }

    return roteWithRelations;
  } catch (error) {
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
    } catch (_error) {
      // 记录变更失败不影响删除操作，静默处理
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
  return (rotes: any, { eq, and, sql }: any) => {
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
          // 处理 tags 的 hasEvery 过滤（检查数组是否包含所有指定的标签）
          if (key === 'tags' && filter[key]?.hasEvery) {
            const tags = filter[key].hasEvery;
            if (Array.isArray(tags) && tags.length > 0) {
              // 使用 PostgreSQL 的 @> 操作符检查数组是否包含所有指定的标签
              // 这里手动构造 ARRAY[...] 字面量，并对单引号进行转义，避免 SQL 注入
              const escapedTags = tags.map((tag: string) => `'${String(tag).replace(/'/g, "''")}'`);
              const tagsCondition = sql`${rotes.tags} @> ARRAY[${sql.raw(
                escapedTags.join(',')
              )}]::text[]`;
              conditions.push(tagsCondition);
            }
            return;
          }

          // 跳过不存在的字段名（如 tag[]），只处理实际存在的数据库字段
          // 检查字段是否存在于 rotes schema 中
          if (!(key in rotes)) {
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

    const queryParams: any = {
      where: whereCondition,
      offset: skip || 0,
      limit: limit || 20,
      orderBy: (rotes: any, { desc }: any) => [desc(rotes.pin), desc(rotes.createdAt)],
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews: any, { asc }: any) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
      },
    };

    const rotesList = await db.query.rotes.findMany(queryParams);
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
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
    const securityConfig = getGlobalConfig<SecurityConfig>('security');
    const requireVerifiedEmailForExplore = securityConfig?.requireVerifiedEmailForExplore === true;

    const conditions: any[] = [];

    // 仅公开且未归档的笔记
    conditions.push(eq(rotes.state, 'public'));
    conditions.push(eq(rotes.archived, false));

    // 处理额外的过滤条件（与 buildWhereConditions 中逻辑保持一致）
    if (filter && typeof filter === 'object') {
      Object.keys(filter).forEach((key) => {
        if (filter[key] !== undefined && filter[key] !== null) {
          // 处理 tags 的 hasEvery 过滤（检查数组是否包含所有指定的标签）
          if (key === 'tags' && filter[key]?.hasEvery) {
            const tags = filter[key].hasEvery;
            if (Array.isArray(tags) && tags.length > 0) {
              const escapedTags = tags.map((tag: string) => `'${String(tag).replace(/'/g, "''")}'`);
              const tagsCondition = sql`${rotes.tags} @> ARRAY[${sql.raw(
                escapedTags.join(',')
              )}]::text[]`;
              conditions.push(tagsCondition);
            }
            return;
          }

          // 跳过不存在的字段名（如 tag[]），只处理实际存在的数据库字段
          if (!(key in rotes)) {
            return;
          }

          conditions.push(eq((rotes as any)[key], filter[key]));
        }
      });
    }

    // 探索页策略：用户设置 + 邮箱验证
    // 1. 如果用户在 user_settings 中将 allowExplore 设为 false，则不展示；
    // 2. 如果配置要求邮箱验证，则只展示 emailVerified = true 的用户；
    conditions.push(
      // 允许：不存在设置行，或 allowExplore != false
      sql`NOT EXISTS (
        SELECT 1 FROM "user_settings" us
        WHERE us."userid" = ${rotes.authorid} AND us."allowExplore" = false
      )`
    );

    if (requireVerifiedEmailForExplore) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = ${rotes.authorid} AND u."emailVerified" = true
        )`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 先在数据库中应用所有过滤条件并分页，只取出 ID 列表
    const rows = await db
      .select({
        id: rotes.id,
      })
      .from(rotes)
      .where(whereClause)
      .offset(skip || 0)
      .limit(limit || 20)
      .orderBy(desc(rotes.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const rotesList = await findRotesByIds(ids);

    // 按照查询到的 ID 顺序返回结果，保持与分页顺序一致
    const roteMap = new Map<string, any>(rotesList.map((rote) => [rote.id, rote]));
    return ids.map((id) => roteMap.get(id)).filter((rote) => rote !== undefined);
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
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
      },
    });

    return rotesList[0] || null;
  } catch (error: any) {
    throw new DatabaseError('Failed to find random user rote', error);
  }
}

export async function findRandomPublicRote(): Promise<any> {
  try {
    const securityConfig = getGlobalConfig<SecurityConfig>('security');
    const requireVerifiedEmailForExplore = securityConfig?.requireVerifiedEmailForExplore === true;

    const conditions: any[] = [];

    // 仅公开且未归档的笔记
    conditions.push(eq(rotes.state, 'public'));
    conditions.push(eq(rotes.archived, false));

    // 探索页策略：用户设置 + 邮箱验证（与 findPublicRote 保持一致）
    conditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM "user_settings" us
        WHERE us."userid" = ${rotes.authorid} AND us."allowExplore" = false
      )`
    );

    if (requireVerifiedEmailForExplore) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = ${rotes.authorid} AND u."emailVerified" = true
        )`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 从满足探索页策略的公开笔记中随机选取一条
    const [row] = await db
      .select({
        id: rotes.id,
      })
      .from(rotes)
      .where(whereClause)
      .orderBy(sql`random()`)
      .limit(1);

    if (!row) {
      throw new DatabaseError('No public rotes found');
    }

    const [rote] = await findRotesByIds([row.id]);
    if (!rote) {
      throw new DatabaseError('No public rotes found');
    }

    return rote;
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
    // ilike() 使用参数化查询，会自动处理转义，所以使用原始 keyword
    // 只有 sql.raw() 需要手动转义，防止 SQL 注入
    const escapedKeyword = String(keyword).replace(/'/g, "''");
    const searchConditions = [
      ilike(rotes.content, `%${keyword}%`),
      ilike(rotes.title, `%${keyword}%`),
      sql`${rotes.tags} @> ARRAY[${sql.raw(`'${escapedKeyword}'`)}]::text[]`,
    ];

    const conditions = [or(...searchConditions)];

    if (authorid) conditions.push(eq(rotes.authorid, authorid));
    if (archived !== undefined) conditions.push(eq(rotes.archived, archived));
    if (state) conditions.push(eq(rotes.state, state));

    // 处理额外的过滤条件
    if (filter && typeof filter === 'object') {
      Object.keys(filter).forEach((key) => {
        if (filter[key] !== undefined && filter[key] !== null) {
          // 处理 tags 的 hasEvery 过滤（检查数组是否包含所有指定的标签）
          if (key === 'tags' && filter[key]?.hasEvery) {
            const tags = filter[key].hasEvery;
            if (Array.isArray(tags) && tags.length > 0) {
              // 使用 PostgreSQL 的 @> 操作符检查数组是否包含所有指定的标签
              // 这里手动构造 ARRAY[...] 字面量，并对单引号进行转义，避免 SQL 注入
              const escapedTags = tags.map((tag: string) => `'${String(tag).replace(/'/g, "''")}'`);
              const tagsCondition = sql`${rotes.tags} @> ARRAY[${sql.raw(
                escapedTags.join(',')
              )}]::text[]`;
              conditions.push(tagsCondition);
            }
            return;
          }

          // 跳过不存在的字段名（如 tag[]），只处理实际存在的数据库字段
          // 检查字段是否存在于 rotes schema 中
          if (!(key in rotes)) {
            return;
          }

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
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
            emailVerified: true,
          },
        },
        attachments: true,
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
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
      throw new Error('User not found');
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
            emailVerified: true,
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
            emailVerified: true,
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

// 根据文章ID查找公开且未归档的笔记（用于文章公开访问）
export async function getNoteByArticleId(articleId: string): Promise<any> {
  try {
    if (!articleId) return null;
    // 查找公开且未归档且 articleId 匹配的笔记
    const note = await db.query.rotes.findFirst({
      where: (rotes, { eq, and }) => and(eq(rotes.articleId, articleId), eq(rotes.archived, false)),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
            emailVerified: true,
          },
        },
        attachments: {
          orderBy: (attachments, { asc }) => [
            asc(attachments.sortIndex),
            asc(attachments.createdAt),
          ],
        },
        linkPreviews: {
          orderBy: (linkPreviews, { asc }) => [asc(linkPreviews.createdAt)],
        },
        reactions: {
          with: {
            user: {
              columns: {
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        article: ARTICLE_QUERY,
      },
    });
    return note || null;
  } catch (error) {
    throw new DatabaseError('Failed to find public note by articleId', error);
  }
}
