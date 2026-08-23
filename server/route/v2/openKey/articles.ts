import { Hono } from 'hono';
import type { HonoContext, HonoVariables } from '../../../types/hono';
import { trackBackgroundTask } from '../../../utils/backgroundTask';
import {
  createArticle,
  deleteArticle,
  deleteEmbeddingsForSource,
  findArticleById,
  findRoteById,
  getNoteArticleCard,
  getNoteByArticleId,
  listMyArticles,
  updateArticle,
} from '../../../utils/dbMethods';
import { createResponse } from '../../../utils/main';
import { ArticleCreateZod, ArticleUpdateZod } from '../../../utils/zod';
import { assertUuid, parseOptionalInteger, requireOpenKey, requireOpenKeyPerm } from './shared';

const router = new Hono<{ Variables: HonoVariables }>();

router.post('/articles', requireOpenKeyPerm('SENDARTICLE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const input = ArticleCreateZod.parse(await c.req.json());
  const article = await createArticle({ content: input.content, authorId: openKey.userid });
  return c.json(createResponse(article), 201);
});

router.get('/articles', requireOpenKeyPerm('GETARTICLE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const articles = await listMyArticles(openKey.userid, {
    skip: parseOptionalInteger(
      c.req.query('skip'),
      'Invalid skip parameter: must be a non-negative integer',
      0
    ),
    limit: parseOptionalInteger(
      c.req.query('limit'),
      'Invalid limit parameter: must be a positive integer',
      1
    ),
    keyword: c.req.query('keyword') || undefined,
  });
  return c.json(createResponse(articles), 200);
});

router.get('/articles/by-note/:noteId', async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const noteId = assertUuid(c.req.param('noteId'), 'Invalid or missing note ID');
  const note = await findRoteById(noteId, openKey.userid);
  if (!note) throw new Error('Note not found');
  if (note.state !== 'public' && note.authorid !== openKey.userid) {
    throw new Error('Access denied: note is private');
  }
  const article = await getNoteArticleCard(noteId, openKey.userid);
  return c.json(createResponse(article ?? null), 200);
});

router.get('/articles/:id', async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
  const article = await findArticleById(id, openKey.userid);
  if (!article) throw new Error('Article not found');

  const note = await getNoteByArticleId(id, openKey.userid);
  if (article.authorId !== openKey.userid && (!note || note.state !== 'public')) {
    throw new Error('Access denied: no public note references this article');
  }
  return c.json(createResponse({ ...article, note }), 200);
});

router.put('/articles/:id', requireOpenKeyPerm('EDITARTICLE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
  const input = ArticleUpdateZod.parse(await c.req.json());
  const article = await updateArticle({ id, authorId: openKey.userid, ...input });
  if (!article) throw new Error('Article not found or permission denied');
  return c.json(createResponse(article), 200);
});

router.delete('/articles/:id', requireOpenKeyPerm('EDITARTICLE'), async (c: HonoContext) => {
  const openKey = requireOpenKey(c);
  const id = assertUuid(c.req.param('id'), 'Invalid or missing ID');
  const article = await deleteArticle({ id, authorId: openKey.userid });
  if (!article) throw new Error('Article not found or permission denied');
  trackBackgroundTask(deleteEmbeddingsForSource('article', id), 'article_embedding_delete_failed');
  return c.json(createResponse(article), 200);
});

export default router;
