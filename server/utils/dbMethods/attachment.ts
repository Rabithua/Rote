import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { attachments, rotes } from '../../drizzle/schema';
import { UploadResult } from '../../types/main';
import db from '../drizzle';
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
      const [maxSortAttachment] = await db
        .select({ sortIndex: attachments.sortIndex })
        .from(attachments)
        .where(eq(attachments.roteid, roteid))
        .orderBy(desc(attachments.sortIndex))
        .limit(1);
      startSortIndex = (maxSortAttachment?.sortIndex || 0) + 1;
    }

    const attachmentsData = data.map((e: UploadResult, index: number) => ({
      // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
      userid,
      roteid: roteid || null,
      url: e.url,
      compressUrl: e.compressUrl || '',
      details: e.details,
      storage: 'R2',
      sortIndex: roteid ? startSortIndex + index : 0,
    }));

    // 使用事务批量插入
    const attachments_new = await db.transaction(
      async (tx) =>
        await Promise.all(
          attachmentsData.map((attachment: any) =>
            tx.insert(attachments).values(attachment).returning()
          )
        )
    );

    return attachments_new.flat();
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
    const results = await db.transaction(async (tx) => {
      const out: any[] = [];
      for (const e of data) {
        const originalKey = (e.details as any)?.key as string | undefined;
        if (!e.url) {
          throw new DatabaseError('Missing original url when upserting attachment');
        }

        if (!originalKey) {
          // 无 key 无法幂等，降级创建
          const [created] = await tx
            .insert(attachments)
            .values({
              // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
              userid,
              roteid: roteid || null,
              url: e.url as string,
              compressUrl: e.compressUrl || '',
              details: e.details,
              storage: 'R2',
            })
            .returning();
          out.push(created);
          continue;
        }

        // 优先通过 JSON 路径匹配 details.key；兼容性兜底：也尝试用 url 匹配
        // 使用 SQL 查询 JSON 字段
        const existingList = await tx
          .select()
          .from(attachments)
          .where(
            and(
              eq(attachments.userid, userid),
              or(
                sql`${attachments.details}->>'key' = ${originalKey}`,
                eq(attachments.url, e.url as string)
              )
            )
          )
          .limit(1);

        const existing = existingList[0];

        if (existing) {
          // 更新压缩信息与元数据；url 保持为原图
          const [updated] = await tx
            .update(attachments)
            .set({
              roteid: roteid ?? existing.roteid ?? null,
              compressUrl: e.compressUrl ?? existing.compressUrl ?? '',
              details: {
                ...(existing.details as any),
                ...(e.details as any),
              },
              updatedAt: new Date(),
            })
            .where(eq(attachments.id, existing.id))
            .returning();
          out.push(updated);
        } else {
          const [created] = await tx
            .insert(attachments)
            .values({
              // 不包含 id 字段，让数据库使用 defaultRandom() 自动生成
              userid,
              roteid: roteid || null,
              url: e.url as string,
              compressUrl: e.compressUrl || '',
              details: e.details,
              storage: 'R2',
            })
            .returning();
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

    const result = await db.transaction(async (tx) => {
      // 先严格校验：必须都是当前用户、且尚未绑定
      const candidates = await tx
        .select({ id: attachments.id })
        .from(attachments)
        .where(
          and(
            inArray(attachments.id, attachmentIds),
            eq(attachments.userid, userid),
            isNull(attachments.roteid)
          )
        );

      if (candidates.length !== attachmentIds.length) {
        throw new DatabaseError(
          'Some attachments cannot be bound (not found, not owned by user, or already bound)'
        );
      }

      // 按照 attachmentIds 的顺序逐个更新，设置对应的 sortIndex
      const updateResults = await Promise.all(
        attachmentIds.map((id, index) =>
          tx
            .update(attachments)
            .set({
              roteid,
              sortIndex: index,
              updatedAt: new Date(),
            })
            .where(eq(attachments.id, id))
            .returning()
        )
      );

      // 更新 rote 的 updatedAt（如果 rote 存在）
      try {
        await tx.update(rotes).set({ updatedAt: new Date() }).where(eq(rotes.id, roteid));
      } catch (_error) {
        // rote 可能不存在，忽略错误
      }

      return { count: updateResults.length };
    });

    // 记录变更历史（如果 rote 存在）
    try {
      const [rote] = await db
        .select({ id: rotes.id, authorid: rotes.authorid })
        .from(rotes)
        .where(eq(rotes.id, roteid))
        .limit(1);
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
    const attachmentsList = await db
      .select({ details: attachments.details })
      .from(attachments)
      .where(and(eq(attachments.roteid, roteid), eq(attachments.userid, userid)));

    if (attachmentsList.length === 0) {
      return { count: 0 };
    }

    // 先获取 rote 信息（用于记录变更）
    const [rote] = await db
      .select({ id: rotes.id, authorid: rotes.authorid })
      .from(rotes)
      .where(eq(rotes.id, roteid))
      .limit(1);

    const result = await db
      .delete(attachments)
      .where(and(eq(attachments.roteid, roteid), eq(attachments.userid, userid)))
      .returning();

    // 更新 rote 的 updatedAt（如果 rote 存在）
    if (rote) {
      try {
        await db.update(rotes).set({ updatedAt: new Date() }).where(eq(rotes.id, roteid));
      } catch (_error) {
        // 忽略更新错误
      }
    }

    attachmentsList.forEach(({ details }) => {
      // @ts-expect-error - details 可能包含动态属性
      const key = details?.key;
      // @ts-expect-error - details 可能包含动态属性
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

    return { count: result.length };
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
    const attachmentsList = await db
      .select()
      .from(attachments)
      .where(
        and(
          inArray(attachments.id, attachmentIds),
          eq(attachments.userid, userId),
          eq(attachments.roteid, roteId)
        )
      );

    if (attachmentsList.length !== attachmentIds.length) {
      throw new DatabaseError('Some attachments not found or unauthorized');
    }

    // 使用事务批量更新排序索引
    const results = await db.transaction(async (tx) => {
      const updateResults = await Promise.all(
        attachmentIds.map((id, index) =>
          tx
            .update(attachments)
            .set({ sortIndex: index, updatedAt: new Date() })
            .where(eq(attachments.id, id))
            .returning()
        )
      );

      // 更新 rote 的 updatedAt（如果 rote 存在）
      try {
        await tx.update(rotes).set({ updatedAt: new Date() }).where(eq(rotes.id, roteId));
      } catch (_error) {
        // rote 可能不存在，忽略错误
      }

      return updateResults.flat();
    });

    // 记录变更历史（如果 rote 存在）
    try {
      const [rote] = await db
        .select({ id: rotes.id, authorid: rotes.authorid })
        .from(rotes)
        .where(eq(rotes.id, roteId))
        .limit(1);
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
  attachmentsData: {
    id: string;
    key?: string;
  }[],
  userid: string
): Promise<any> {
  try {
    const dbAttachments = await db
      .select({ id: attachments.id, details: attachments.details, roteid: attachments.roteid })
      .from(attachments)
      .where(
        and(
          inArray(
            attachments.id,
            attachmentsData.map((e) => e.id)
          ),
          eq(attachments.userid, userid)
        )
      );

    if (dbAttachments.length !== attachmentsData.length) {
      throw new DatabaseError('Some attachments not found or unauthorized');
    }

    // 收集需要更新的 rote ID（去重）
    const roteIds = new Set(
      dbAttachments.map((a) => a.roteid).filter((id): id is string => id !== null)
    );

    const result = await db
      .delete(attachments)
      .where(
        and(
          inArray(
            attachments.id,
            attachmentsData.map((e) => e.id)
          ),
          eq(attachments.userid, userid)
        )
      )
      .returning();

    // 更新相关 rote 的 updatedAt 并记录变更历史
    for (const roteid of roteIds) {
      try {
        const [rote] = await db
          .select({ id: rotes.id, authorid: rotes.authorid })
          .from(rotes)
          .where(eq(rotes.id, roteid))
          .limit(1);

        if (rote) {
          // 更新 rote 的 updatedAt
          await db.update(rotes).set({ updatedAt: new Date() }).where(eq(rotes.id, roteid));

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
      // @ts-expect-error - details 可能包含动态属性
      const key = details?.key;
      // @ts-expect-error - details 可能包含动态属性
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
    attachmentsData.forEach(({ key }) => {
      if (key) {
        r2deletehandler(key).catch((err) => {
          console.error(`Failed to delete attachment (compat) from R2: ${key}`, err);
        });
      }
    });

    return { count: result.length };
  } catch (error) {
    throw new DatabaseError('Failed to delete attachments', error);
  }
}

export async function deleteAttachment(id: string, userid: string): Promise<any> {
  try {
    // 先查出对象 key 和 roteid，再删除 DB 记录与对象存储
    const [record] = await db
      .select({ id: attachments.id, details: attachments.details, roteid: attachments.roteid })
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userid, userid)))
      .limit(1);

    const result = await db
      .delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userid, userid)))
      .returning();

    // 如果附件绑定了 rote，更新 rote 的 updatedAt 并记录变更历史
    if (record?.roteid) {
      try {
        const [rote] = await db
          .select({ id: rotes.id, authorid: rotes.authorid })
          .from(rotes)
          .where(eq(rotes.id, record.roteid))
          .limit(1);

        if (rote) {
          // 更新 rote 的 updatedAt
          await db.update(rotes).set({ updatedAt: new Date() }).where(eq(rotes.id, record.roteid));

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
      // @ts-expect-error - details 可能包含动态属性
      const key = record.details?.key;
      // @ts-expect-error - details 可能包含动态属性
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

    return { count: result.length };
  } catch (error) {
    throw new DatabaseError(`Failed to delete attachment: ${id} for user: ${userid}`, error);
  }
}
