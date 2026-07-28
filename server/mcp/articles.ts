import {
  createArticle,
  deleteArticle,
  findArticleById,
  findRoteById,
  getNoteArticleCard,
  getNoteByArticleId,
  listMyArticles,
  updateArticle,
} from '../utils/dbMethods';
import { ArticleCreateZod, ArticleUpdateZod } from '../utils/zod';
import mcpErrors from './errorCodes.json';
import { defineMcpTool } from './registry';
import { assertUuid, parseOptionalInteger, parseOptionalLimit, requireAuth } from './shared';
import type { McpTool } from './types';

export const articleTools: McpTool[] = [
  defineMcpTool('articles_create', async (c, args) => {
    const auth = requireAuth(c);
    ArticleCreateZod.parse(args);
    return await createArticle({ content: args.content, authorId: auth.userId });
  }),
  defineMcpTool('articles_list', async (c, args) => {
    const auth = requireAuth(c);
    return await listMyArticles(auth.userId, {
      skip: parseOptionalInteger(args.skip, 'skip'),
      limit: parseOptionalLimit(args.limit),
      keyword: typeof args.keyword === 'string' ? args.keyword : undefined,
    });
  }),
  defineMcpTool('articles_get', async (c, args) => {
    const auth = requireAuth(c);
    const id = assertUuid(args.id, 'article_id');
    const article = await findArticleById(id, auth.userId);
    if (!article) throw new Error(mcpErrors.articleNotFound);
    const note = await getNoteByArticleId(id, auth.userId);
    if (article.authorId === auth.userId || note?.state === 'public') return { ...article, note };
    throw new Error(mcpErrors.articleAccessDenied);
  }),
  defineMcpTool('articles_get_by_note', async (c, args) => {
    const auth = requireAuth(c);
    const noteId = assertUuid(args.noteId, 'note_id');
    const note = await findRoteById(noteId, auth.userId);
    if (!note) throw new Error(mcpErrors.noteNotFound);
    if (note.state !== 'public' && note.authorid !== auth.userId) {
      throw new Error(mcpErrors.notePrivate);
    }
    return await getNoteArticleCard(noteId, auth.userId);
  }),
  defineMcpTool('articles_update', async (c, args) => {
    const auth = requireAuth(c);
    const id = assertUuid(args.id, 'article_id');
    ArticleUpdateZod.parse(args);
    const updated = await updateArticle({ id, authorId: auth.userId, content: args.content });
    if (!updated) throw new Error(mcpErrors.articleNotFoundOrDenied);
    return updated;
  }),
  defineMcpTool('articles_delete', async (c, args) => {
    const auth = requireAuth(c);
    const id = assertUuid(args.id, 'article_id');
    const removed = await deleteArticle({ id, authorId: auth.userId });
    if (!removed) throw new Error(mcpErrors.articleNotFoundOrDenied);
    return removed;
  }),
];
