/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import { Hono } from 'hono';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  addReaction,
  createArticle,
  createRote,
  findMyRote,
  findRoteById,
  removeReaction,
  searchMyRotes,
  setNoteArticleId,
} from '../../utils/dbMethods';
import { parseAndStoreRoteLinkPreviews } from '../../utils/linkPreview';
import { createResponse, isOpenKeyOk, isValidUUID } from '../../utils/main';
import {
  ArticleCreateZod,
  NoteCreateZod,
  ReactionCreateZod,
  SearchKeywordZod,
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

export default router;
