import { UploadResult } from '../../types/main';
import prisma from '../prisma';
import { r2deletehandler } from '../r2';
import { createRoteChange } from './change';
import { DatabaseError } from './common';

// 附件相关方法
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

      // 更新 rote 的 updatedAt（如果 rote 存在）
      try {
        await tx.rote.update({
          where: { id: roteid },
          data: { updatedAt: new Date() },
        });
      } catch (error) {
        // rote 可能不存在，忽略错误
      }

      return { count: updateResults.length };
    });

    // 记录变更历史（如果 rote 存在）
    try {
      const rote = await prisma.rote.findUnique({
        where: { id: roteid },
        select: { id: true, authorid: true },
      });
      if (rote) {
        await createRoteChange({
          originid: rote.id,
          roteid: rote.id,
          action: 'UPDATE',
          userid: rote.authorid,
        });
      }
    } catch (error) {
      // 记录变更失败不影响操作，只记录错误
      console.error('Failed to record rote change for bind attachments:', error);
    }

    return { count: result.count };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to bind attachments to rote: ${roteid}`, error);
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

    // 先获取 rote 信息（用于记录变更）
    const rote = await prisma.rote.findUnique({
      where: { id: roteid },
      select: { id: true, authorid: true },
    });

    const result = await prisma.attachment.deleteMany({
      where: { roteid, userid },
    });

    // 更新 rote 的 updatedAt（如果 rote 存在）
    if (rote) {
      try {
        await prisma.rote.update({
          where: { id: roteid },
          data: { updatedAt: new Date() },
        });
      } catch (error) {
        // 忽略更新错误
      }
    }

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

    // 记录变更历史（如果 rote 存在）
    if (rote) {
      try {
        await createRoteChange({
          originid: rote.id,
          roteid: rote.id,
          action: 'UPDATE',
          userid: rote.authorid,
        });
      } catch (error) {
        // 记录变更失败不影响操作，只记录错误
        console.error('Failed to record rote change for delete attachments:', error);
      }
    }

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
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = await Promise.all(
        attachmentIds.map((id, index) =>
          tx.attachment.update({
            where: { id },
            data: { sortIndex: index } as any,
          })
        )
      );

      // 更新 rote 的 updatedAt（如果 rote 存在）
      try {
        await tx.rote.update({
          where: { id: roteId },
          data: { updatedAt: new Date() },
        });
      } catch (error) {
        // rote 可能不存在，忽略错误
      }

      return updateResults;
    });

    // 记录变更历史（如果 rote 存在）
    try {
      const rote = await prisma.rote.findUnique({
        where: { id: roteId },
        select: { id: true, authorid: true },
      });
      if (rote) {
        await createRoteChange({
          originid: rote.id,
          roteid: rote.id,
          action: 'UPDATE',
          userid: rote.authorid,
        });
      }
    } catch (error) {
      // 记录变更失败不影响操作，只记录错误
      console.error('Failed to record rote change for update attachment sort order:', error);
    }

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
      select: { id: true, details: true, roteid: true },
    });

    if (dbAttachments.length !== attachments.length) {
      throw new DatabaseError('Some attachments not found or unauthorized');
    }

    // 收集需要更新的 rote ID（去重）
    const roteIds = new Set(
      dbAttachments.map((a) => a.roteid).filter((id): id is string => id !== null)
    );

    const result = await prisma.attachment.deleteMany({
      where: {
        id: {
          in: attachments.map((e) => e.id),
        },
        userid,
      },
    });

    // 更新相关 rote 的 updatedAt 并记录变更历史
    for (const roteid of roteIds) {
      try {
        const rote = await prisma.rote.findUnique({
          where: { id: roteid },
          select: { id: true, authorid: true },
        });

        if (rote) {
          // 更新 rote 的 updatedAt
          await prisma.rote.update({
            where: { id: roteid },
            data: { updatedAt: new Date() },
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
            console.error(`Failed to record rote change for delete attachment: ${roteid}`, error);
          }
        }
      } catch (error) {
        // 忽略单个 rote 更新错误
        console.error(`Failed to update rote for delete attachment: ${roteid}`, error);
      }
    }

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
    // 先查出对象 key 和 roteid，再删除 DB 记录与对象存储
    const record = await prisma.attachment.findFirst({
      where: { id, userid },
      select: { id: true, details: true, roteid: true },
    });

    const result = await prisma.attachment.deleteMany({
      where: { id, userid },
    });

    // 如果附件绑定了 rote，更新 rote 的 updatedAt 并记录变更历史
    if (record?.roteid) {
      try {
        const rote = await prisma.rote.findUnique({
          where: { id: record.roteid },
          select: { id: true, authorid: true },
        });

        if (rote) {
          // 更新 rote 的 updatedAt
          await prisma.rote.update({
            where: { id: record.roteid },
            data: { updatedAt: new Date() },
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
            console.error(
              `Failed to record rote change for delete attachment: ${record.roteid}`,
              error
            );
          }
        }
      } catch (error) {
        // 忽略更新错误
        console.error(`Failed to update rote for delete attachment: ${record.roteid}`, error);
      }
    }

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
