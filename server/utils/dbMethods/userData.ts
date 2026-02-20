import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { attachments, rotes } from '../../drizzle/schema';
import db from '../drizzle';
import { DatabaseError } from './common';

export async function statistics(authorid: string): Promise<any> {
  try {
    const [noteCountResult, attachmentsList] = await Promise.all([
      db.select({ count: count() }).from(rotes).where(eq(rotes.authorid, authorid)),
      db.select().from(attachments).where(eq(attachments.userid, authorid)),
    ]);

    return {
      noteCount: noteCountResult[0]?.count || 0,
      attachmentsCount: attachmentsList.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user statistics', error);
  }
}

export async function exportData(authorid: string): Promise<any> {
  try {
    // 使用 relational query API 获取关联数据
    const notes = await db.query.rotes.findMany({
      where: (rotes, { eq }) => eq(rotes.authorid, authorid),
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        attachments: true,
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
    return { notes };
  } catch (error) {
    throw new DatabaseError('Failed to export user data', error);
  }
}

export async function getHeatMap(userId: string, startDate: string, endDate: string): Promise<any> {
  try {
    const rotesList = await db
      .select()
      .from(rotes)
      .where(
        and(
          eq(rotes.authorid, userId),
          gte(rotes.createdAt, new Date(startDate)),
          lte(rotes.createdAt, new Date(endDate))
        )
      );

    if (rotesList.length === 0) {
      return {};
    }

    return rotesList.reduce((acc: any, item: any) => {
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
    const tagCounts = await db
      .select({
        name: sql<string>`unnest(${rotes.tags})`,
        count: sql<number>`count(*)::int`,
      })
      .from(rotes)
      .where(eq(rotes.authorid, userid))
      .groupBy(sql`unnest(${rotes.tags})`)
      .orderBy(sql`count(*) desc`);
    return tagCounts;
  } catch (error) {
    throw new DatabaseError('Failed to get user tags', error);
  }
}

export async function importData(userId: string, data: any): Promise<any> {
  const { notes } = data;

  if (!Array.isArray(notes)) {
    throw new Error('Invalid data format: notes must be an array');
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    await db.transaction(async (tx) => {
      // 检查并在需要时创建默认附件（如果逻辑需要，这里暂时跳过）

      if (notes && notes.length > 0) {
        for (const note of notes) {
          // 1. 安全检查：如果笔记已存在，检查所有权
          // 注意：exportData 中使用的是 db.query.rotes.findMany
          // 这里使用 tx.query.rotes.findFirst
          const existingNote = await tx.query.rotes.findFirst({
            where: eq(rotes.id, note.id),
          });

          if (existingNote) {
            if (existingNote.authorid !== userId) {
              // 严格模式：报错
              throw new Error(
                `Security violation: Cannot update note ${note.id} owned by another user`
              );
            }
            updatedCount++;
          } else {
            createdCount++;
          }

          // 2. 准备笔记数据
          const noteData = {
            ...note,
            authorid: userId, // 强制归属
            updatedAt: new Date(),
            // createdAt 保持原样或重置，这里保留原样如果存在
            createdAt: note.createdAt ? new Date(note.createdAt) : new Date(),
          };

          // 移除关联对象
          delete noteData.author;
          delete noteData.attachments;
          delete noteData.reactions;
          delete noteData.linkPreviews;
          delete noteData.changes;

          // 3. Upsert
          await tx.insert(rotes).values(noteData).onConflictDoUpdate({
            target: rotes.id,
            set: noteData,
          });

          // 4. 处理附件
          if (Array.isArray(note.attachments)) {
            for (const attachment of note.attachments) {
              const existingAttachment = await tx.query.attachments.findFirst({
                where: eq(attachments.id, attachment.id),
              });

              if (existingAttachment && existingAttachment.userid !== userId) {
                throw new Error(
                  `Security violation: Cannot update attachment ${attachment.id} owned by another user`
                );
              }

              const attachmentData = {
                ...attachment,
                userid: userId, // 强制归属
                roteid: note.id,
                updatedAt: new Date(),
                createdAt: attachment.createdAt ? new Date(attachment.createdAt) : new Date(),
              };
              delete attachmentData.rote;
              delete attachmentData.user;

              await tx.insert(attachments).values(attachmentData).onConflictDoUpdate({
                target: attachments.id,
                set: attachmentData,
              });
            }
          }
        }
      }
    });

    return {
      count: notes.length,
      created: createdCount,
      updated: updatedCount,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Security violation')) {
      throw new DatabaseError(error.message, error);
    }
    throw new DatabaseError('Failed to import user data', error);
  }
}
