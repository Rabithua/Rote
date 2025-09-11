import crypto from 'crypto';
import { UploadResult } from '../types/main';
import prisma from './prisma';
import { r2deletehandler } from './r2';

// Define unified error type
class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

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

export async function addSubScriptionToUser(userId: string, subScription: any): Promise<any> {
  try {
    const subScriptionRespon = await prisma.userSwSubScription.create({
      data: {
        userid: userId,
        endpoint: subScription.endpoint,
        expirationTime: subScription.expirationTime,
        keys: {
          auth: subScription.keys.auth,
          p256dh: subScription.keys.p256dh,
        },
      },
      select: { id: true },
    });
    return subScriptionRespon;
  } catch (error) {
    throw new DatabaseError('Failed to add subscription', error);
  }
}

export async function findSubScriptionToUser(subId: string): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { id: subId },
    });

    if (!subscription) {
      throw new DatabaseError('Subscription not found');
    }

    return subscription;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to find subscription: ${subId}`, error);
  }
}

export async function findSubScriptionToUserByUserId(userId: string): Promise<any> {
  try {
    const subscriptions = await prisma.userSwSubScription.findMany({
      where: { userid: userId },
    });

    if (!subscriptions) {
      throw new DatabaseError('Subscriptions not found');
    }

    return subscriptions;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to find subscriptions for user: ${userId}`, error);
  }
}

// 获取所有活跃的订阅 - 用于公开笔记通知
export async function findAllActiveSubscriptions(): Promise<any> {
  try {
    const subscriptions = await prisma.userSwSubScription.findMany({
      where: {
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    return subscriptions;
  } catch (error) {
    throw new DatabaseError('Failed to find all active subscriptions', error);
  }
}

export async function findSubScriptionToUserByendpoint(endpoint: string): Promise<any> {
  try {
    const subscription = await prisma.userSwSubScription.findUnique({
      where: { endpoint },
      select: { id: true },
    });
    return subscription;
  } catch (error) {
    throw new DatabaseError('Failed to find subscription by endpoint', error);
  }
}

export async function deleteSubScription(subId: string): Promise<any> {
  try {
    const result = await prisma.userSwSubScription.delete({
      where: { id: subId },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Failed to delete subscription: ${subId}`, error);
  }
}

export async function updateSubScription(
  subId: string,
  userId: string,
  updateData: any
): Promise<any> {
  try {
    // 首先验证订阅是否存在且属于当前用户
    const existingSubscription = await prisma.userSwSubScription.findUnique({
      where: { id: subId },
    });

    if (!existingSubscription) {
      throw new DatabaseError('Subscription not found');
    }

    if (existingSubscription.userid !== userId) {
      throw new DatabaseError('User does not match');
    }

    // 准备更新数据
    const updateFields: any = {};

    if (updateData.endpoint) {
      updateFields.endpoint = updateData.endpoint;
    }

    if (updateData.expirationTime !== undefined) {
      updateFields.expirationTime = updateData.expirationTime;
    }

    if (updateData.status) {
      updateFields.status = updateData.status;
    }

    if (updateData.note !== undefined) {
      updateFields.note = updateData.note;
    }

    if (updateData.keys) {
      updateFields.keys = {
        auth: updateData.keys.auth,
        p256dh: updateData.keys.p256dh,
      };
    }

    const result = await prisma.userSwSubScription.update({
      where: { id: subId },
      data: updateFields,
    });

    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update subscription: ${subId}`, error);
  }
}

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
    return rote;
  } catch (error) {
    console.error(`Error updating rote: ${data.id}`, error);

    throw new DatabaseError(`Failed to update rote: ${data.id}`, error);
  }
}

export async function deleteRote(data: any): Promise<any> {
  try {
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

export async function deleteRoteAttachmentsByRoteId(roteid: string, userid: string): Promise<any> {
  try {
    const attachments = await prisma.attachment.findMany({
      where: { roteid, userid },
      select: { details: true },
    });

    if (attachments.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.attachment.deleteMany({
      where: { roteid, userid },
    });

    attachments.forEach(({ details }) => {
      // @ts-ignore
      const key = details?.key;
      // @ts-ignore
      const compressKey = details?.compressKey;
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment from R2: ${key}`, err);
        });
      }
      if (compressKey) {
        r2deletehandler(compressKey).catch((err) => {
          console.error(`Failed to delete compressed attachment from R2: ${compressKey}`, err);
        });
      }
    });

    return result;
  } catch (error) {
    throw new DatabaseError(`Failed to delete attachments for rote: ${roteid}`, error);
  }
}

export async function updateAttachmentsSortOrder(
  userId: string,
  roteId: string,
  attachmentIds: string[]
): Promise<any> {
  try {
    // 验证所有附件都属于该用户和该笔记
    const attachments = await prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        userid: userId,
        roteid: roteId,
      },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new DatabaseError('Some attachments not found or unauthorized');
    }

    // 使用事务批量更新排序索引
    const results = await prisma.$transaction(
      attachmentIds.map((id, index) =>
        prisma.attachment.update({
          where: { id },
          data: { sortIndex: index } as any,
        })
      )
    );

    return results;
  } catch (error) {
    throw new DatabaseError('Failed to update attachment sort order', error);
  }
}

export async function deleteAttachments(
  attachments: {
    id: string;
    key?: string;
  }[],
  userid: string
): Promise<any> {
  try {
    const dbAttachments = await prisma.attachment.findMany({
      where: {
        id: {
          in: attachments.map((e) => e.id),
        },
        userid,
      },
      select: { id: true, details: true },
    });

    if (dbAttachments.length !== attachments.length) {
      throw new DatabaseError('Some attachments not found or unauthorized');
    }

    const result = await prisma.attachment.deleteMany({
      where: {
        id: {
          in: attachments.map((e) => e.id),
        },
        userid,
      },
    });

    // 优先使用 DB 中的 details 删除，以涵盖压缩文件；兼容传入 key 的旧行为
    dbAttachments.forEach(({ details }) => {
      // @ts-ignore
      const key = details?.key;
      // @ts-ignore
      const compressKey = details?.compressKey;
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment from R2: ${key}`, err);
        });
      }
      if (compressKey) {
        r2deletehandler(compressKey).catch((err) => {
          console.error(`Failed to delete compressed attachment from R2: ${compressKey}`, err);
        });
      }
    });

    // 兼容性：如果请求体传入了 key，但 DB 没有 details（历史数据），也尝试删除
    attachments.forEach(({ key }) => {
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment (compat) from R2: ${key}`, err);
        });
      }
    });

    return result;
  } catch (error) {
    throw new DatabaseError('Failed to delete attachments', error);
  }
}

export async function deleteAttachment(id: string, userid: string): Promise<any> {
  try {
    // 先查出对象 key，再删除 DB 记录与对象存储
    const record = await prisma.attachment.findFirst({
      where: { id, userid },
      select: { id: true, details: true },
    });

    const result = await prisma.attachment.deleteMany({
      where: { id, userid },
    });

    if (record?.details) {
      // @ts-ignore
      const key = record.details?.key;
      // @ts-ignore
      const compressKey = record.details?.compressKey;
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment from R2: ${key}`, err);
        });
      }
      if (compressKey) {
        r2deletehandler(compressKey).catch((err) => {
          console.error(`Failed to delete compressed attachment from R2: ${compressKey}`, err);
        });
      }
    }

    return result;
  } catch (error) {
    throw new DatabaseError(`Failed to delete attachment: ${id} for user: ${userid}`, error);
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

export async function generateOpenKey(userid: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.create({
      data: {
        permissions: ['SENDROTE'],
        userid,
      },
    });
    return openKey;
  } catch (error) {
    throw new DatabaseError('Failed to generate open key', error);
  }
}

export async function getMyOpenKey(userid: string): Promise<any> {
  try {
    const openKeys = await prisma.userOpenKey.findMany({
      where: { userid },
    });
    return openKeys;
  } catch (error) {
    throw new DatabaseError('Failed to get user open keys', error);
  }
}

export async function deleteMyOneOpenKey(userid: string, id: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to delete this open key');
    }

    const result = await prisma.userOpenKey.delete({
      where: { id },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to delete open key: ${id}`, error);
  }
}

export async function editMyOneOpenKey(
  userid: string,
  id: string,
  permissions: string[]
): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to edit this open key');
    }

    const result = await prisma.userOpenKey.update({
      where: { id },
      data: { permissions },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update open key: ${id}`, error);
  }
}

export async function getOneOpenKey(id: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    return openKey;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get open key: ${id}`, error);
  }
}

export async function createAttachments(
  userid: string,
  roteid: string | undefined,
  data: UploadResult[]
): Promise<any> {
  try {
    // 如果绑定到笔记，获取当前笔记的最大排序索引
    let startSortIndex = 0;
    if (roteid) {
      const maxSortAttachment = await prisma.attachment.findFirst({
        where: { roteid },
        orderBy: { sortIndex: 'desc' } as any,
        select: { sortIndex: true } as any,
      });
      startSortIndex = ((maxSortAttachment as any)?.sortIndex || 0) + 1;
    }

    const attachments = data.map((e: UploadResult, index: number) => ({
      userid,
      roteid,
      url: e.url,
      compressUrl: e.compressUrl,
      details: e.details,
      storage: 'R2',
      sortIndex: roteid ? startSortIndex + index : 0,
    }));

    const attachments_new = await prisma.$transaction(
      attachments.map((attachment: any) =>
        prisma.attachment.create({
          data: attachment,
        })
      )
    );
    return attachments_new;
  } catch (error) {
    throw new DatabaseError('Failed to create attachments', error);
  }
}

// 基于原图对象 Key（details.key）进行幂等写入：存在则更新压缩信息，不存在则创建
export async function upsertAttachmentsByOriginalKey(
  userid: string,
  roteid: string | undefined,
  data: UploadResult[]
): Promise<any[]> {
  try {
    const results = await prisma.$transaction(async (tx) => {
      const out: any[] = [];
      for (const e of data) {
        const originalKey = (e.details as any)?.key as string | undefined;
        if (!e.url) {
          throw new DatabaseError('Missing original url when upserting attachment');
        }

        if (!originalKey) {
          // 无 key 无法幂等，降级创建
          const created = await tx.attachment.create({
            data: {
              userid,
              roteid,
              url: e.url as string,
              compressUrl: e.compressUrl || undefined,
              details: e.details,
              storage: 'R2',
            },
          });
          out.push(created);
          continue;
        }

        // 优先通过 JSON 路径匹配 details.key；兼容性兜底：也尝试用 url 匹配
        const existing = await tx.attachment.findFirst({
          where: {
            userid,
            OR: [
              {
                details: {
                  path: ['key'],
                  equals: originalKey,
                } as any,
              },
              { url: e.url as string },
            ],
          },
        });

        if (existing) {
          // 更新压缩信息与元数据；url 保持为原图
          const updated = await tx.attachment.update({
            where: { id: existing.id },
            data: {
              roteid: roteid ?? existing.roteid ?? undefined,
              compressUrl: e.compressUrl ?? existing.compressUrl ?? undefined,
              details: {
                ...(existing.details as any),
                ...(e.details as any),
              },
            },
          });
          out.push(updated);
        } else {
          const created = await tx.attachment.create({
            data: {
              userid,
              roteid,
              url: e.url as string,
              compressUrl: e.compressUrl || undefined,
              details: e.details,
              storage: 'R2',
            },
          });
          out.push(created);
        }
      }
      return out;
    });
    return results;
  } catch (error) {
    // 打印底层错误，便于排查
    console.error('[upsertAttachmentsByOriginalKey] error:', error);
    throw new DatabaseError('Failed to upsert attachments by original key', error);
  }
}

// 将预上传且未绑定的附件绑定到笔记
export async function bindAttachmentsToRote(
  userid: string,
  roteid: string,
  attachmentIds: string[]
): Promise<{ count: number }> {
  try {
    if (!attachmentIds || attachmentIds.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 先严格校验：必须都是当前用户、且尚未绑定
      const candidates = await tx.attachment.findMany({
        where: {
          id: { in: attachmentIds },
          userid,
          roteid: { equals: null },
        },
        select: { id: true },
      });

      if (candidates.length !== attachmentIds.length) {
        throw new DatabaseError(
          'Some attachments cannot be bound (not found, not owned by user, or already bound)'
        );
      }

      // 按照 attachmentIds 的顺序逐个更新，设置对应的 sortIndex
      const updatePromises = attachmentIds.map((id, index) =>
        tx.attachment.update({
          where: { id },
          data: {
            roteid,
            sortIndex: index,
          } as any,
        })
      );

      const updateResults = await Promise.all(updatePromises);

      return { count: updateResults.length };
    });

    return { count: result.count };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to bind attachments to rote: ${roteid}`, error);
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

// 搜索相关方法
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

// 反应相关方法
export async function addReaction(data: {
  type: string;
  roteid: string;
  userid?: string;
  visitorId?: string;
  visitorInfo?: any;
  metadata?: any;
}): Promise<any> {
  try {
    const reaction = await prisma.reaction.create({
      data: {
        type: data.type,
        roteid: data.roteid,
        userid: data.userid,
        visitorId: data.visitorId,
        visitorInfo: data.visitorInfo,
        metadata: data.metadata,
      },
    });
    return reaction;
  } catch (error) {
    throw new DatabaseError('Failed to add reaction', error);
  }
}

export async function removeReaction(data: {
  type: string;
  roteid: string;
  userid?: string;
  visitorId?: string;
}): Promise<any> {
  try {
    const whereClause: any = {
      type: data.type,
      roteid: data.roteid,
    };

    if (data.userid) {
      whereClause.userid = data.userid;
    } else if (data.visitorId) {
      whereClause.visitorId = data.visitorId;
    }

    const reaction = await prisma.reaction.deleteMany({
      where: whereClause,
    });
    return reaction;
  } catch (error) {
    throw new DatabaseError('Failed to remove reaction', error);
  }
}
