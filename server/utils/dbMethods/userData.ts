import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { articles, attachments, noteImportSources, rotes } from '../../drizzle/schema';
import { importUserData } from '../../imports/importService';
import db from '../drizzle';
import { DatabaseError } from './common';

export async function statistics(authorid: string): Promise<any> {
  try {
    const [roteCountResult, attachmentsList, articleCountResult] = await Promise.all([
      db.select({ count: count() }).from(rotes).where(eq(rotes.authorid, authorid)),
      db.select().from(attachments).where(eq(attachments.userid, authorid)),
      db.select({ count: count() }).from(articles).where(eq(articles.authorId, authorid)),
    ]);

    return {
      roteCount: roteCountResult[0]?.count || 0,
      attachmentCount: attachmentsList.length,
      articleCount: articleCountResult[0]?.count || 0,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get user statistics', error);
  }
}

export async function exportData(authorid: string): Promise<any> {
  try {
    // 使用 relational query API 获取关联数据
    const [notes, userArticles, importSources] = await Promise.all([
      db.query.rotes.findMany({
        where: (rotes, { eq }) => eq(rotes.authorid, authorid),
        with: {
          author: {
            columns: {
              username: true,
              nickname: true,
              avatar: true,
            },
          },
          article: true,
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
      }),
      db.select().from(articles).where(eq(articles.authorId, authorid)),
      db.select().from(noteImportSources).where(eq(noteImportSources.ownerId, authorid)),
    ]);
    const sourcesByRoteId = new Map(importSources.map((source) => [source.roteId, source]));
    const exportedNotes = notes.map((note) => {
      const importSource = sourcesByRoteId.get(note.id);
      if (!importSource) return note;

      const attachmentMap = readImportAttachmentMap(importSource.attachmentMap);
      const sourceByAttachmentId = new Map(
        Object.entries(attachmentMap).map(([sourceKey, attachmentId]) => [
          attachmentId,
          parseAttachmentSourceKey(sourceKey, importSource),
        ])
      );

      return {
        ...note,
        source: {
          provider: importSource.provider,
          accountId: importSource.accountId,
          externalId: importSource.externalId,
          ...(importSource.sourceUpdatedAt
            ? { sourceUpdatedAt: importSource.sourceUpdatedAt.toISOString() }
            : {}),
        },
        attachments: note.attachments.map((attachment) => {
          const source = sourceByAttachmentId.get(attachment.id);
          return source
            ? {
                ...attachment,
                source,
              }
            : attachment;
        }),
      };
    });

    return { formatVersion: 2, notes: exportedNotes, articles: userArticles };
  } catch (error) {
    throw new DatabaseError('Failed to export user data', error);
  }
}

function readImportAttachmentMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function parseAttachmentSourceKey(
  value: string,
  fallback: { provider: string; accountId: string }
): { provider: string; accountId: string; externalId: string } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((part) => typeof part === 'string')
    ) {
      return { provider: parsed[0], accountId: parsed[1], externalId: parsed[2] };
    }
  } catch {
    // Older mappings stored only the attachment external ID.
  }
  return { provider: fallback.provider, accountId: fallback.accountId, externalId: value };
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

export async function importData(userId: string, data: unknown): Promise<any> {
  return importUserData(userId, data);
}
