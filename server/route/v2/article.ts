import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { authenticateJWT, optionalJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  createArticle,
  deleteArticle,
  findArticleById,
  findRoteById,
  getArticleInNoteContext,
  getNoteArticleCard,
  listMyArticles,
  setNoteArticleId,
  updateArticle,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse, isValidUUID } from '../../utils/main';
import { ArticleCreateZod, ArticleUpdateZod } from '../../utils/zod';

const articlesRouter = new Hono<{ Variables: HonoVariables }>();

function isNoteAccessible(rote: any, user?: User | null) {
  if (!rote) return false;
  if (rote.state === 'public') return true;
  if (user && rote.authorid === user.id) return true;
  return false;
}

// 创建文章
articlesRouter.post('/', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const body = await c.req.json();
  ArticleCreateZod.parse(body);

  const user = c.get('user') as User;
  const { content } = body as { content: string };

  const article = await createArticle({ content, authorId: user.id });

  return c.json(createResponse(article), 201);
});

// 更新文章
articlesRouter.put('/:id', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const body = await c.req.json();
  ArticleUpdateZod.parse(body);

  const updated = await updateArticle({ id, authorId: user.id, ...body });
  if (!updated) {
    throw new Error('Article not found or permission denied');
  }

  return c.json(createResponse(updated), 200);
});

// 删除文章
articlesRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const removed = await deleteArticle({ id, authorId: user.id });
  if (!removed) {
    throw new Error('Article not found or permission denied');
  }

  // 删除文章会级联将 rotes.articleId 设为 null（数据库外键 onDelete set null）
  return c.json(createResponse(removed), 200);
});

// 我的文章列表（用于选择引用）
articlesRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const keyword = c.req.query('keyword');

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;
  const parsedKeyword = typeof keyword === 'string' ? keyword : undefined;

  const items = await listMyArticles(user.id, {
    skip: parsedSkip,
    limit: parsedLimit,
    keyword: parsedKeyword,
  });

  return c.json(createResponse(items), 200);
});

// 获取某个笔记下的文章引用（简略，用于卡片展示）
articlesRouter.get('/by-note/:noteId', optionalJWT, async (c: HonoContext) => {
  const user = c.get('user') as User | undefined;
  const noteId = c.req.param('noteId');

  if (!noteId || !isValidUUID(noteId)) {
    throw new Error('Invalid or missing noteId');
  }

  const note = await findRoteById(noteId);
  if (!isNoteAccessible(note, user)) {
    throw new Error('Access denied: note is private');
  }

  const article = await getNoteArticleCard(noteId);
  return c.json(createResponse(article), 200);
});

// 获取文章全文（需要上下文 noteId 或作者权限）
articlesRouter.get('/:id', optionalJWT, async (c: HonoContext) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  const noteId = c.req.query('noteId');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const article = await findArticleById(id);
  if (!article) {
    throw new Error('Article not found');
  }

  // 作者可直接访问
  if (user && article.authorId === user.id) {
    return c.json(createResponse(article), 200);
  }

  // 非作者必须提供 noteId，并且该笔记可访问且包含引用
  if (!noteId || !isValidUUID(noteId)) {
    throw new Error('noteId is required to access this article');
  }

  const note = await findRoteById(noteId);
  if (!isNoteAccessible(note, user || null)) {
    throw new Error('Access denied: note is private');
  }

  const articleInContext = await getArticleInNoteContext(id, noteId);
  if (!articleInContext) {
    throw new Error('Article is not referenced by the specified note');
  }

  return c.json(createResponse(articleInContext), 200);
});

// 更新笔记与文章引用（仅作者，一对一绑定）
articlesRouter.post('/refs/:noteId', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const noteId = c.req.param('noteId');
  const body = await c.req.json();
  const articleIds = (body?.articleIds ?? []) as string[];
  const articleId = (body?.articleId ?? null) as string | null;

  if (!noteId || !isValidUUID(noteId)) {
    throw new Error('Invalid or missing noteId');
  }

  // 优先使用 articleId，其次使用 articleIds 的第一个（一对一绑定）
  const articleIdToSet =
    articleId !== null && typeof articleId === 'string'
      ? articleId
      : Array.isArray(articleIds) && articleIds.length > 0
        ? articleIds[0]
        : null;

  await setNoteArticleId(noteId, articleIdToSet, user.id);

  const article = await getNoteArticleCard(noteId);
  return c.json(createResponse(article), 200);
});

export default articlesRouter;
