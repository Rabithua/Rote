import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { type Article, articles, rotes } from '../../drizzle/schema';
import db from '../drizzle';
import { parseMarkdownMeta } from '../markdown';
import { deleteEmbeddingsForSource, enqueueEmbeddingJob } from './ai';
import { createRoteChange } from './change';
import { DatabaseError } from './common';
import { subjectIsVisibleToViewer } from './userBlock';

export interface ArticleMeta {
  title: string;
  summary: string;
}

export type ArticleWithMeta = Article & ArticleMeta;

export type ArticleAuthor = {
  username: string;
  nickname: string | null;
  avatar: string | null;
  certified: boolean;
};

export type ArticleWithAuthor = ArticleWithMeta & {
  author: ArticleAuthor;
};

function normalizeArticleAuthor<T extends { author?: any }>(article: T): any {
  // TODO: 下下次更新移除 emailVerified 作者字段兼容，统一只返回 certified。
  if (article.author && 'emailVerified' in article.author) {
    article.author.certified = article.author.emailVerified;
    delete article.author.emailVerified;
  }
  return article;
}

// 设置笔记的文章绑定（一对一关系）
export async function setNoteArticleId(
  noteId: string,
  articleId: string | null,
  authorId: string
): Promise<void> {
  try {
    const note = await db.query.rotes.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, noteId),
      columns: { id: true, authorid: true, articleId: true },
    });
    if (!note || note.authorid !== authorId) {
      throw new Error('Note not found or permission denied');
    }

    // 只在 articleId 发生变化时更新和记录变更
    if (note.articleId === articleId) {
      return;
    }

    if (articleId) {
      const [owned] = await findArticlesByIds([articleId], authorId);
      if (!owned) {
        throw new Error('Article does not belong to current user');
      }
    }

    await db.update(rotes).set({ articleId, updatedAt: new Date() }).where(eq(rotes.id, noteId));

    // 记录变更历史
    try {
      await createRoteChange({
        originid: noteId,
        roteid: noteId,
        action: 'UPDATE',
        userid: authorId,
      });
    } catch (_error) {
      // 记录变更失败不影响操作
    }
  } catch (error: any) {
    throw new DatabaseError('Failed to set note article', error);
  }
}

// 创建文章
export async function createArticle(data: {
  content: string;
  authorId: string;
}): Promise<ArticleWithMeta> {
  try {
    const [article] = await db
      .insert(articles)
      .values({
        ...data,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .returning();

    if (!article) {
      throw new Error('Failed to insert article: no data returned');
    }

    // 补充计算字段
    const meta = parseMarkdownMeta(article.content);
    void enqueueEmbeddingJob('article', article.id, article.authorId).catch((error) => {
      console.error('Failed to enqueue article embedding job:', error);
    });
    return { ...article, ...meta };
  } catch (error: any) {
    throw new DatabaseError('Failed to create article', error);
  }
}

// 更新文章
export async function updateArticle(data: {
  id: string;
  authorId: string;
  content?: string;
}): Promise<ArticleWithMeta | null> {
  try {
    const { id, authorId, ...rest } = data;
    const [article] = await db
      .update(articles)
      .set({
        ...rest,
        updatedAt: new Date(),
      })
      .where(and(eq(articles.id, id), eq(articles.authorId, authorId)))
      .returning();

    if (!article) return null;

    // 记录绑定到此 article 的 rote 的变更历史（保证 /changes/after 增量同步能感知）
    try {
      const boundRotes = await db
        .select({ id: rotes.id })
        .from(rotes)
        .where(eq(rotes.articleId, id));
      for (const r of boundRotes) {
        await createRoteChange({
          originid: r.id,
          roteid: r.id,
          action: 'UPDATE',
          userid: authorId,
        });
      }
    } catch (_error) {
      // 记录变更失败不影响操作
    }

    const meta = parseMarkdownMeta(article.content);
    void enqueueEmbeddingJob('article', article.id, article.authorId).catch((error) => {
      console.error('Failed to enqueue article embedding job:', error);
    });
    return { ...article, ...meta };
  } catch (error: any) {
    throw new DatabaseError(`Failed to update article: ${data.id}`, error);
  }
}

// 删除文章
export async function deleteArticle(data: {
  id: string;
  authorId: string;
}): Promise<Article | null> {
  try {
    // 先查询绑定到此 article 的 rote，用于删除后写 changelog
    const boundRotes = await db
      .select({ id: rotes.id })
      .from(rotes)
      .where(eq(rotes.articleId, data.id));

    const [article] = await db
      .delete(articles)
      .where(and(eq(articles.id, data.id), eq(articles.authorId, data.authorId)))
      .returning();

    if (!article) return null;

    // 删除成功后为受影响的 rote 写 UPDATE changelog（rote 仍存在，只是 articleId 变 null）
    try {
      for (const r of boundRotes) {
        await createRoteChange({
          originid: r.id,
          roteid: r.id,
          action: 'UPDATE',
          userid: data.authorId,
        });
      }
    } catch (_error) {
      // 记录变更失败不影响操作
    }

    void deleteEmbeddingsForSource('article', data.id).catch((error) => {
      console.error('Failed to delete article embeddings:', error);
    });

    return article;
  } catch (error: any) {
    throw new DatabaseError(`Failed to delete article: ${data.id}`, error);
  }
}

// 获取单篇文章（包含作者基础字段）
export async function findArticleById(
  id: string,
  viewerId?: string
): Promise<ArticleWithAuthor | null> {
  try {
    const article = await db.query.articles.findFirst({
      where: (tbl, { and, eq }) => {
        const visible = subjectIsVisibleToViewer(tbl.authorId, viewerId);
        return visible ? and(eq(tbl.id, id), visible) : eq(tbl.id, id);
      },
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
            emailVerified: true,
          },
        },
      },
    });
    if (!article) return null;
    const meta = parseMarkdownMeta(article.content);
    return normalizeArticleAuthor({ ...article, ...meta });
  } catch (error: any) {
    throw new DatabaseError(`Failed to find article by id: ${id}`, error);
  }
}

// 批量获取作者的文章，支持搜索
export async function listMyArticles(
  authorId: string,
  params?: { skip?: number; limit?: number; keyword?: string }
): Promise<ArticleWithMeta[]> {
  try {
    const { skip, limit, keyword } = params || {};

    const whereClause = keyword
      ? and(eq(articles.authorId, authorId), ilike(articles.content, `%${keyword}%`))
      : eq(articles.authorId, authorId);

    const result = await db
      .select()
      .from(articles)
      .where(whereClause)
      .orderBy(desc(articles.createdAt))
      .limit(limit ?? 20)
      .offset(skip ?? 0);

    // 为列表补充 title/summary 计算字段
    return result.map((a) => ({ ...a, ...parseMarkdownMeta(a.content) }));
  } catch (error: any) {
    throw new DatabaseError('Failed to list articles', error);
  }
}

// 校验文章归属
export async function findArticlesByIds(ids: string[], authorId?: string): Promise<Article[]> {
  try {
    if (!ids.length) return [];
    const whereClause = authorId
      ? and(inArray(articles.id, ids), eq(articles.authorId, authorId))
      : inArray(articles.id, ids);

    const found = await db.select().from(articles).where(whereClause);
    return found;
  } catch (error: any) {
    throw new DatabaseError('Failed to find articles by ids', error);
  }
}

// 替换笔记的文章引用（仅作者）
export async function replaceNoteArticleRefs(
  noteId: string,
  articleIds: string[],
  authorId: string
): Promise<void> {
  if (Array.isArray(articleIds) && articleIds.length > 1) {
    throw new Error('Only one article is allowed per note');
  }
  const articleId = Array.isArray(articleIds) && articleIds.length === 1 ? articleIds[0] : null;
  return setNoteArticleId(noteId, articleId, authorId);
}

// 获取某个笔记下的文章引用（简略字段）
export async function getNoteArticleCard(
  noteId: string,
  viewerId?: string
): Promise<ArticleWithAuthor | null> {
  try {
    const note = await db.query.rotes.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, noteId),
      columns: { articleId: true },
    });
    if (!note?.articleId) return null;

    const article = await db.query.articles.findFirst({
      where: (tbl, { and, eq }) => {
        const visible = subjectIsVisibleToViewer(tbl.authorId, viewerId);
        return visible
          ? and(eq(tbl.id, note.articleId as any), visible)
          : eq(tbl.id, note.articleId as any);
      },
      columns: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
      },
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
            emailVerified: true,
          },
        },
      },
    });
    if (!article) return null;

    const meta = parseMarkdownMeta(article.content);
    return normalizeArticleAuthor({ ...article, ...meta });
  } catch (error: any) {
    throw new DatabaseError('Failed to get note article', error);
  }
}

// 获取某个笔记上下文中的文章全文（必须存在引用）
export async function getArticleInNoteContext(
  articleId: string,
  noteId: string,
  viewerId?: string
): Promise<ArticleWithAuthor | null> {
  try {
    const note = await db.query.rotes.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, noteId),
      columns: { articleId: true },
    });
    if (!note?.articleId) return null;
    if (note.articleId !== articleId) return null;

    const article = await db.query.articles.findFirst({
      where: (tbl, { and, eq }) => {
        const visible = subjectIsVisibleToViewer(tbl.authorId, viewerId);
        return visible ? and(eq(tbl.id, articleId), visible) : eq(tbl.id, articleId);
      },
      with: {
        author: {
          columns: {
            username: true,
            nickname: true,
            avatar: true,
            emailVerified: true,
          },
        },
      },
    });
    if (!article) return null;
    const meta = parseMarkdownMeta(article.content);
    return normalizeArticleAuthor({ ...article, ...meta });
  } catch (error: any) {
    throw new DatabaseError('Failed to get article in note context', error);
  }
}
