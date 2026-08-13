/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import { Hono } from 'hono';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { assertUsersMayInteract } from '../../userBlocks/service';
import {
  addReaction,
  createArticle,
  createRote,
  deleteArticle,
  deleteAttachment,
  deleteAttachments,
  deleteEmbeddingsForSource,
  deleteRote,
  deleteRoteAttachmentsByRoteId,
  deleteRoteLinkPreviewsByRoteId,
  editMyProfile,
  editRote,
  enqueueEmbeddingJob,
  findArticleById,
  findMyRote,
  findRoteById,
  findRotesByIds,
  getHeatMap,
  getMyProfile,
  getMySettings,
  getMyTags,
  getNoteArticleCard,
  getNoteByArticleId,
  listMyArticles,
  removeReaction,
  searchMyRotes,
  setNoteArticleId,
  statistics,
  updateArticle,
  updateAttachmentsSortOrder,
  updateMySettings,
} from '../../utils/dbMethods';
import { MAX_BATCH_SIZE } from '../../utils/fileValidation';
import { extractUrlsFromContent, parseAndStoreRoteLinkPreviews } from '../../utils/linkPreview';
import { createResponse, isOpenKeyOk, isValidUUID } from '../../utils/main';
import {
  ArticleCreateZod,
  ArticleUpdateZod,
  NoteCreateZod,
  NoteUpdateZod,
  ReactionCreateZod,
  SearchKeywordZod,
  UsernameUpdateZod,
} from '../../utils/zod';

const router = new Hono<{ Variables: HonoVariables }>();

function requireOpenKeyPerm(...perms: string[]) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const openKey = c.get('openKey')!;
    if (!openKey) throw new Error('Need openkey!');

    // Require ANY of the provided permissions.
    if (perms.length > 0 && !perms.some((p) => openKey.permissions?.includes(p))) {
      throw new Error('API key permission does not match');
    }

    await next();
  };
}

// 处理标签，过滤空白标签并验证长度
const processTags = (tags: any): string[] => {
  if (Array.isArray(tags)) {
    const processed = tags
      .filter((t) => t && typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim());
    // 验证标签长度和数量
    if (processed.length > 20) {
      throw new Error('Maximum 20 tags allowed');
    }
    for (const tag of processed) {
      if (tag.length > 50) {
        throw new Error('Single tag cannot exceed 50 characters');
      }
    }
    return processed;
  }
  if (tags && typeof tags === 'string' && tags.trim().length > 0) {
    const trimmed = tags.trim();
    if (trimmed.length > 50) {
      throw new Error('Single tag cannot exceed 50 characters');
    }
    return [trimmed];
  }
  return [];
};

// Create article using API key - POST method
router.post('/articles', isOpenKeyOk, requireOpenKeyPerm('SENDARTICLE'), async (c: HonoContext) => {
  const body = await c.req.json();
  ArticleCreateZod.parse(body);

  const openKey = c.get('openKey')!;
  const { content } = body as { content: string };
  const article = await createArticle({ content, authorId: openKey.userid });
  return c.json(createResponse(article), 201);
});

// List user articles using API key
// NOTE: This route must be defined BEFORE /articles/:id to avoid matching issues
router.get('/articles', isOpenKeyOk, requireOpenKeyPerm('GETARTICLE'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const keyword = c.req.query('keyword');

  // Validate pagination parameters
  let parsedSkip: number | undefined;
  let parsedLimit: number | undefined;

  if (typeof skip === 'string') {
    parsedSkip = parseInt(skip, 10);
    if (!Number.isFinite(parsedSkip) || parsedSkip < 0) {
      throw new Error('Invalid skip parameter: must be a non-negative integer');
    }
  }

  if (typeof limit === 'string') {
    parsedLimit = parseInt(limit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      throw new Error('Invalid limit parameter: must be a positive integer');
    }
  }

  const articles = await listMyArticles(openKey.userid, {
    skip: parsedSkip,
    limit: parsedLimit,
    keyword: keyword || undefined,
  });

  return c.json(createResponse(articles), 200);
});

// Get article by note ID using API key
// NOTE: This route must be defined BEFORE /articles/:id to avoid matching issues
router.get('/articles/by-note/:noteId', isOpenKeyOk, async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const noteId = c.req.param('noteId');

  if (!noteId || !isValidUUID(noteId)) {
    throw new Error('Invalid or missing note ID');
  }

  // Check if user has access to the note
  const note = await findRoteById(noteId, openKey.userid);
  if (!note) {
    throw new Error('Note not found');
  }

  // Only allow access if note is public or belongs to the user
  if (note.state !== 'public' && note.authorid !== openKey.userid) {
    throw new Error('Access denied: note is private');
  }

  const article = await getNoteArticleCard(noteId, openKey.userid);
  if (!article) {
    return c.json(createResponse(null), 200);
  }

  return c.json(createResponse(article), 200);
});

// Get article by ID using API key
router.get('/articles/:id', isOpenKeyOk, async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const id = c.req.param('id');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const article = await findArticleById(id, openKey.userid);

  if (!article) {
    throw new Error('Article not found');
  }

  const note = await getNoteByArticleId(id, openKey.userid);

  if (article.authorId === openKey.userid) {
    return c.json(createResponse({ ...article, note }), 200);
  }

  if (!note || note.state !== 'public') {
    throw new Error('Access denied: no public note references this article');
  }

  return c.json(createResponse({ ...article, note }), 200);
});

// Update article using API key
router.put(
  '/articles/:id',
  isOpenKeyOk,
  requireOpenKeyPerm('EDITARTICLE'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const id = c.req.param('id');

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid or missing ID');
    }

    const body = await c.req.json();
    ArticleUpdateZod.parse(body);

    const updated = await updateArticle({ id, authorId: openKey.userid, ...body });
    if (!updated) {
      throw new Error('Article not found or permission denied');
    }

    return c.json(createResponse(updated), 200);
  }
);

// Delete article using API key
router.delete(
  '/articles/:id',
  isOpenKeyOk,
  requireOpenKeyPerm('EDITARTICLE'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const id = c.req.param('id');

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid or missing ID');
    }

    const removed = await deleteArticle({ id, authorId: openKey.userid });
    if (!removed) {
      throw new Error('Article not found or permission denied');
    }

    void deleteEmbeddingsForSource('article', id).catch((error) => {
      console.error('Failed to delete article embeddings (openkey):', error);
    });

    return c.json(createResponse(removed), 200);
  }
);

// Create note using API key - GET method (kept for backward compatibility)
router.get('/notes/create', isOpenKeyOk, requireOpenKeyPerm('SENDROTE'), async (c: HonoContext) => {
  const content = c.req.query('content');
  const state = c.req.query('state');
  const type = c.req.query('type');
  const title = c.req.query('title');
  const tags = c.req.queries('tag');
  const pin = c.req.query('pin');

  // 确保 content 是字符串类型
  if (!content || typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  // 验证输入长度（适配 query 参数）
  if (content.length > 1000000) {
    throw new Error('Content cannot exceed 1,000,000 characters');
  }

  const openKey = c.get('openKey')!;

  const rote = {
    content,
    title: title || '',
    state: state || 'private',
    type: type || 'Rote',
    tags: processTags(tags),
    pin: !!pin,
  };

  const result = await createRote({
    ...rote,
    authorid: openKey.userid,
  });

  void enqueueEmbeddingJob('rote', result.id, openKey.userid).catch((error) => {
    console.error('Failed to enqueue rote embedding job (openkey):', error);
  });

  // Optional: bind a single article (same behavior as authenticated API).
  const articleId = c.req.query('articleId');
  if (articleId && typeof articleId === 'string') {
    await setNoteArticleId(result.id, articleId, openKey.userid);
    return c.json(createResponse(result), 201);
  }

  // Keep behavior consistent with the authenticated notes API: generate link previews asynchronously.
  void parseAndStoreRoteLinkPreviews(result.id, result.content).catch((error) => {
    console.error('Failed to parse link previews (openkey create):', error);
  });

  return c.json(createResponse(result), 201);
});

// Create note using API key - POST method for /notes/create endpoint
router.post(
  '/notes/create',
  isOpenKeyOk,
  requireOpenKeyPerm('SENDROTE'),
  async (c: HonoContext) => {
    const body = await c.req.json();
    const { content, state, type, title, tags, pin } = body;

    if (!content) {
      throw new Error('Content is required');
    }

    // 验证输入长度（验证整个 body，确保所有字段都被验证）
    NoteCreateZod.parse(body);

    const openKey = c.get('openKey')!;

    const rote = {
      content,
      title: title || '',
      state: state || 'private',
      type: type || 'rote',
      tags: processTags(tags),
      pin: !!pin,
    };

    const result = await createRote({
      ...rote,
      authorid: openKey.userid,
    });

    void enqueueEmbeddingJob('rote', result.id, openKey.userid).catch((error) => {
      console.error('Failed to enqueue rote embedding job (openkey):', error);
    });

    // Optional: bind a single article (same behavior as authenticated API).
    const articleIdToSet =
      typeof (body as any).articleId === 'string'
        ? (body as any).articleId
        : Array.isArray((body as any).articleIds) && (body as any).articleIds.length > 0
          ? (body as any).articleIds[0]
          : null;

    if (articleIdToSet) {
      await setNoteArticleId(result.id, articleIdToSet, openKey.userid);
      return c.json(createResponse(result), 201);
    }

    // Keep behavior consistent with the authenticated notes API: generate link previews asynchronously.
    void parseAndStoreRoteLinkPreviews(result.id, result.content).catch((error) => {
      console.error('Failed to parse link previews (openkey create):', error);
    });

    return c.json(createResponse(result), 201);
  }
);

// Create note using API key - POST method (proper RESTful interface)
router.post('/notes', isOpenKeyOk, requireOpenKeyPerm('SENDROTE'), async (c: HonoContext) => {
  const body = await c.req.json();
  const { content, state, type, title, tags, pin } = body;

  if (!content) {
    throw new Error('Content is required');
  }

  // 验证输入长度（验证整个 body，确保所有字段都被验证）
  NoteCreateZod.parse(body);

  const openKey = c.get('openKey')!;

  const rote = {
    content,
    title: title || '',
    state: state || 'private',
    type: type || 'rote',
    tags: processTags(tags),
    pin: !!pin,
  };

  const result = await createRote({
    ...rote,
    authorid: openKey.userid,
  });

  void enqueueEmbeddingJob('rote', result.id, openKey.userid).catch((error) => {
    console.error('Failed to enqueue rote embedding job (openkey):', error);
  });

  // Optional: bind a single article (same behavior as authenticated API).
  const articleIdToSet =
    typeof (body as any).articleId === 'string'
      ? (body as any).articleId
      : Array.isArray((body as any).articleIds) && (body as any).articleIds.length > 0
        ? (body as any).articleIds[0]
        : null;

  if (articleIdToSet) {
    await setNoteArticleId(result.id, articleIdToSet, openKey.userid);
    return c.json(createResponse(result), 201);
  }

  // Keep behavior consistent with the authenticated notes API: generate link previews asynchronously.
  void parseAndStoreRoteLinkPreviews(result.id, result.content).catch((error) => {
    console.error('Failed to parse link previews (openkey create):', error);
  });

  return c.json(createResponse(result), 201);
});

// Retrieve notes using API key
router.get('/notes', isOpenKeyOk, requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');

  const openKey = c.get('openKey')!;
  if (!openKey?.permissions.includes('GETROTE')) {
    throw new Error('API key permission does not match');
  }

  // 构建过滤器对象
  const filter: any = {};
  const query = c.req.query();

  // 处理标签过滤，过滤空白标签（支持 tag 和 tag[] 两种格式）
  const tag = c.req.query('tag') || c.req.query('tag[]');
  if (tag) {
    let tags: string[] = [];
    if (Array.isArray(tag)) {
      tags = tag
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => (t as string).trim());
    } else if (typeof tag === 'string' && tag.trim().length > 0) {
      tags = [tag.trim()];
    }

    if (tags.length > 0) {
      filter.tags = { hasEvery: tags };
    }
  }

  // 处理其他过滤参数（排除已知的查询参数和数组格式的 tag）
  const excludedKeys = ['skip', 'limit', 'archived', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  const rotes = await findMyRote(
    openKey.userid,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rotes), 200);
});

// Search notes using API key
router.get('/notes/search', isOpenKeyOk, requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const keyword = c.req.query('keyword');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');

  const openKey = c.get('openKey')!;
  if (!openKey) {
    throw new Error('API key is required');
  }

  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Keyword is required');
  }

  // 验证搜索关键词长度
  SearchKeywordZod.parse({ keyword });

  // 构建过滤器对象
  const filter: any = {};
  const query = c.req.query();

  // 处理标签过滤（支持 tag 和 tag[] 两种格式）
  const tag = c.req.query('tag') || c.req.query('tag[]');
  if (tag) {
    let tags: string[] = [];
    if (Array.isArray(tag)) {
      tags = tag
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => (t as string).trim());
    } else if (typeof tag === 'string' && tag.trim().length > 0) {
      tags = [tag.trim()];
    }

    if (tags.length > 0) {
      filter.tags = { hasEvery: tags };
    }
  }

  // 处理其他过滤参数（排除已知的查询参数和数组格式的 tag）
  const excludedKeys = ['skip', 'limit', 'archived', 'keyword', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  const rotes = await searchMyRotes(
    openKey.userid,
    keyword,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rotes), 200);
});

// Batch get notes by IDs using API key
router.post('/notes/batch', isOpenKeyOk, requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const body = await c.req.json();
  const { ids } = body as { ids: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('IDs array is required');
  }

  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum ${MAX_BATCH_SIZE} IDs allowed`);
  }

  // Validate all IDs are valid UUIDs
  for (const id of ids) {
    if (!isValidUUID(id)) {
      throw new Error(`Invalid ID format: ${id}`);
    }
  }

  const notes = await findRotesByIds(ids, openKey.userid);

  // Filter notes: only return public notes or notes owned by the user
  const accessibleNotes = notes.filter(
    (note) => note.state === 'public' || note.authorid === openKey.userid
  );

  return c.json(createResponse(accessibleNotes), 200);
});

// Get note by ID using API key
router.get('/notes/:id', isOpenKeyOk, requireOpenKeyPerm('GETROTE'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const id = c.req.param('id');

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const rote = await findRoteById(id, openKey.userid);
  if (!rote) {
    throw new Error('Note not found');
  }

  if (rote.state === 'public' || rote.authorid === openKey.userid) {
    return c.json(createResponse(rote), 200);
  }

  throw new Error('Access denied: note is private');
});

// Update note using API key
router.put('/notes/:id', isOpenKeyOk, requireOpenKeyPerm('EDITROTE'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  NoteUpdateZod.parse(body);

  await editRote({ ...body, id, authorid: openKey.userid });

  void enqueueEmbeddingJob('rote', id, openKey.userid).catch((error) => {
    console.error('Failed to enqueue rote embedding job (openkey):', error);
  });

  let articleIdToSet: string | null | undefined;
  if ('articleId' in (body as any)) {
    const articleId = (body as any).articleId;
    articleIdToSet = typeof articleId === 'string' ? articleId : (articleId ?? null);
  } else if (Array.isArray((body as any).articleIds)) {
    articleIdToSet = (body as any).articleIds.length > 0 ? (body as any).articleIds[0] : null;
  }

  if (articleIdToSet !== undefined) {
    await setNoteArticleId(id, articleIdToSet, openKey.userid);
  }

  const data = await findRoteById(id, openKey.userid);
  const hasArticle = Boolean(data?.articleId || data?.article);
  const contentProvided = Object.prototype.hasOwnProperty.call(body, 'content');
  const contentForPreview = contentProvided ? (body as any).content : data?.content;

  if (hasArticle && articleIdToSet !== undefined) {
    await deleteRoteLinkPreviewsByRoteId(id);
  } else if (
    (contentProvided || articleIdToSet !== undefined) &&
    typeof contentForPreview === 'string'
  ) {
    const urls = extractUrlsFromContent(contentForPreview);
    if (urls.length === 0 || hasArticle) {
      await deleteRoteLinkPreviewsByRoteId(id);
    } else {
      await deleteRoteLinkPreviewsByRoteId(id);
      void parseAndStoreRoteLinkPreviews(id, contentForPreview).catch((error) => {
        console.error('Failed to parse link previews:', error);
      });
    }
  }

  return c.json(createResponse(data), 200);
});

// Delete note using API key
// Keep EDITROTE for backward compatibility, but DELETEROTE is the dedicated permission.
router.delete(
  '/notes/:id',
  isOpenKeyOk,
  requireOpenKeyPerm('DELETEROTE', 'EDITROTE'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const id = c.req.param('id');

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid or missing ID');
    }

    const data = await deleteRote({ id, authorid: openKey.userid });
    await deleteRoteAttachmentsByRoteId(id, openKey.userid);

    void deleteEmbeddingsForSource('rote', id).catch((error) => {
      console.error('Failed to delete rote embeddings (openkey):', error);
    });

    return c.json(createResponse(data), 200);
  }
);

// Query current OpenKey permissions
router.get('/permissions', isOpenKeyOk, async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  return c.json(
    createResponse({
      permissions: openKey.permissions || [],
    }),
    200
  );
});

// Add reaction using API key
router.post(
  '/reactions',
  isOpenKeyOk,
  requireOpenKeyPerm('ADDREACTION'),
  async (c: HonoContext) => {
    const body = await c.req.json();
    const { type, roteid, metadata } = body;

    // Validate required fields
    if (!type || !roteid) {
      throw new Error('Type and rote ID are required');
    }

    // Validate input using zod
    ReactionCreateZod.parse({ type, roteid });

    // Validate roteid format
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    // Check if note exists
    const rote = await findRoteById(roteid);
    if (!rote) {
      throw new Error('Rote not found');
    }

    const openKey = c.get('openKey')!;
    await assertUsersMayInteract(openKey.userid, rote.authorid);

    // Build reaction data with OpenKey user
    const reactionData = {
      type,
      roteid,
      userid: openKey.userid,
      metadata,
    };

    const reaction = await addReaction(reactionData);
    return c.json(createResponse(reaction), 201);
  }
);

// Remove reaction using API key
router.delete(
  '/reactions/:roteid/:type',
  isOpenKeyOk,
  requireOpenKeyPerm('DELETEREACTION'),
  async (c: HonoContext) => {
    const roteid = c.req.param('roteid');
    const type = c.req.param('type');

    if (!type || !roteid) {
      throw new Error('Type and rote ID are required');
    }

    // Validate roteid format
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    const openKey = c.get('openKey')!;

    // Remove reaction for this OpenKey user
    const result = await removeReaction({
      type,
      roteid,
      userid: openKey.userid,
    });

    return c.json(createResponse(result), 200);
  }
);

// Get profile using API key
router.get('/profile', isOpenKeyOk, requireOpenKeyPerm('EDITPROFILE'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const profile = await getMyProfile(openKey.userid);
  return c.json(createResponse(profile), 200);
});

// Update profile using API key
router.put('/profile', isOpenKeyOk, requireOpenKeyPerm('EDITPROFILE'), async (c: HonoContext) => {
  const body = await c.req.json();
  const openKey = c.get('openKey')!;

  // Validate username if provided (same as /users/me/profile)
  if (body.username !== undefined) {
    UsernameUpdateZod.parse({ username: body.username });
  }

  const profile = await editMyProfile(openKey.userid, body);
  return c.json(createResponse(profile), 200);
});

// --- User Data Endpoints via OpenKey ---

// Get tags statistics using API key
router.get('/tags', isOpenKeyOk, requireOpenKeyPerm('GETTAGS'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const tags = await getMyTags(openKey.userid);
  return c.json(createResponse(tags), 200);
});

// Get activity heatmap using API key
router.get('/heatmap', isOpenKeyOk, requireOpenKeyPerm('GETSTATISTICS'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required');
  }

  // Validate date format (YYYY-MM-DD) and that it's a real calendar date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  // Validate that dates are real calendar dates
  const startDateObj = new Date(startDate + 'T00:00:00Z');
  const endDateObj = new Date(endDate + 'T00:00:00Z');

  if (isNaN(startDateObj.getTime())) {
    throw new Error('Invalid startDate: not a valid calendar date');
  }
  if (isNaN(endDateObj.getTime())) {
    throw new Error('Invalid endDate: not a valid calendar date');
  }

  // Additional check: verify the parsed date matches the input (catches dates like 2026-02-30)
  const startDateStr = startDateObj.toISOString().slice(0, 10);
  const endDateStr = endDateObj.toISOString().slice(0, 10);
  if (startDateStr !== startDate) {
    throw new Error('Invalid startDate: not a valid calendar date');
  }
  if (endDateStr !== endDate) {
    throw new Error('Invalid endDate: not a valid calendar date');
  }

  const heatmap = await getHeatMap(openKey.userid, startDate, endDate);
  return c.json(createResponse(heatmap), 200);
});

// Get statistics using API key
router.get(
  '/statistics',
  isOpenKeyOk,
  requireOpenKeyPerm('GETSTATISTICS'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const stats = await statistics(openKey.userid);
    return c.json(createResponse(stats), 200);
  }
);

// Get user settings using API key
router.get('/settings', isOpenKeyOk, requireOpenKeyPerm('GETSETTINGS'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const settings = await getMySettings(openKey.userid);
  return c.json(createResponse(settings), 200);
});

// Update user settings using API key
router.put('/settings', isOpenKeyOk, requireOpenKeyPerm('EDITSETTINGS'), async (c: HonoContext) => {
  const openKey = c.get('openKey')!;
  const body = await c.req.json();
  const settings = await updateMySettings(openKey.userid, body);
  return c.json(createResponse(settings), 200);
});

// --- Attachment Management via OpenKey ---

// Delete attachment using API key
router.delete(
  '/attachments/:id',
  isOpenKeyOk,
  requireOpenKeyPerm('DELETEATTACHMENT'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const id = c.req.param('id');

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid attachment ID');
    }

    const data = await deleteAttachment(id, openKey.userid);
    return c.json(createResponse(data), 200);
  }
);

// Batch delete attachments using API key
router.delete(
  '/attachments',
  isOpenKeyOk,
  requireOpenKeyPerm('DELETEATTACHMENT'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const body = await c.req.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('IDs array is required');
    }

    if (ids.length > MAX_BATCH_SIZE) {
      throw new Error(`Maximum ${MAX_BATCH_SIZE} IDs allowed`);
    }

    // Validate all IDs are valid UUIDs
    for (const id of ids) {
      if (!isValidUUID(id)) {
        throw new Error(`Invalid ID format: ${id}`);
      }
    }

    // Convert string IDs to the expected format
    const attachmentsData = ids.map((id) => ({ id }));
    const result = await deleteAttachments(attachmentsData, openKey.userid);
    return c.json(createResponse(result), 200);
  }
);

// Update attachments sort order using API key
router.put(
  '/attachments/sort',
  isOpenKeyOk,
  requireOpenKeyPerm('EDITROTE'),
  async (c: HonoContext) => {
    const openKey = c.get('openKey')!;
    const body = await c.req.json();
    const { noteId, attachmentIds } = body as { noteId: string; attachmentIds: string[] };

    if (!noteId || !isValidUUID(noteId)) {
      throw new Error('Invalid or missing note ID');
    }

    if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      throw new Error('Attachment IDs array is required');
    }

    if (attachmentIds.length > MAX_BATCH_SIZE) {
      throw new Error(`Maximum ${MAX_BATCH_SIZE} attachments allowed`);
    }

    // Validate all IDs are valid UUIDs
    for (const id of attachmentIds) {
      if (!isValidUUID(id)) {
        throw new Error(`Invalid attachment ID format: ${id}`);
      }
    }

    // Verify the note belongs to the user
    const note = await findRoteById(noteId, openKey.userid);
    if (!note) {
      throw new Error('Note not found');
    }
    if (note.authorid !== openKey.userid) {
      throw new Error('Access denied: note does not belong to you');
    }

    const result = await updateAttachmentsSortOrder(openKey.userid, noteId, attachmentIds);
    return c.json(createResponse(result), 200);
  }
);

export default router;
