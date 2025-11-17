/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import { Hono } from 'hono';
import { HonoContext } from '../../types/hono';
import { createRote, findMyRote, searchMyRotes } from '../../utils/dbMethods';
import { createResponse, isOpenKeyOk, queryTypeCheck } from '../../utils/main';
import { NoteCreateZod, SearchKeywordZod } from '../../utils/zod';

const router = new Hono<{ Variables: HonoContext['Variables'] }>();

// Create note using API key - GET method (kept for backward compatibility)
router.get('/notes/create', isOpenKeyOk, queryTypeCheck, async (c: HonoContext) => {
  const content = c.req.query('content');
  const state = c.req.query('state');
  const type = c.req.query('type');
  const tag = c.req.query('tag');
  const pin = c.req.query('pin');

  // 确保 content 是字符串类型
  if (!content || typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  // 验证输入长度（适配 query 参数）
  if (content.length > 1000000) {
    throw new Error('内容不能超过 1,000,000 个字符');
  }

  const openKey = c.get('openKey');
  if (!openKey?.permissions.includes('SENDROTE')) {
    throw new Error('API key permission does not match');
  }

  // 处理标签，过滤空白标签并验证长度
  const processTags = (tags: any): string[] => {
    if (Array.isArray(tags)) {
      const processed = tags
        .filter((t) => t && typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim());
      // 验证标签长度和数量
      if (processed.length > 20) {
        throw new Error('最多只能添加 20 个标签');
      }
      for (const tag of processed) {
        if (tag.length > 50) {
          throw new Error('单个标签不能超过 50 个字符');
        }
      }
      return processed;
    }
    if (tags && typeof tags === 'string' && tags.trim().length > 0) {
      const trimmed = tags.trim();
      if (trimmed.length > 50) {
        throw new Error('单个标签不能超过 50 个字符');
      }
      return [trimmed];
    }
    return [];
  };

  const rote = {
    content,
    state: state || 'private',
    type: type || 'Rote',
    tags: processTags(tag),
    pin: !!pin,
  };

  const result = await createRote({
    ...rote,
    authorid: openKey.userid,
  });

  return c.json(createResponse(result), 201);
});

// Create note using API key - POST method (proper RESTful interface)
router.post('/notes', isOpenKeyOk, async (c: HonoContext) => {
  const body = await c.req.json();
  const { content, state, type, tags, pin } = body;

  if (!content) {
    throw new Error('Content is required');
  }

  // 验证输入长度（验证整个 body，确保所有字段都被验证）
  NoteCreateZod.parse(body);

  const openKey = c.get('openKey');
  if (!openKey?.permissions.includes('SENDROTE')) {
    throw new Error('API key permission does not match');
  }

  // 处理标签，过滤空白标签
  const processTags = (tags: any): string[] => {
    if (Array.isArray(tags)) {
      return tags
        .filter((t) => t && typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim());
    }
    if (tags && typeof tags === 'string' && tags.trim().length > 0) {
      return tags
        .split(' ')
        .filter((t) => t.trim().length > 0)
        .map((t) => t.trim());
    }
    return [];
  };

  const rote = {
    content,
    state: state || 'private',
    type: type || 'rote',
    tags: processTags(tags),
    pin: !!pin,
  };

  const result = await createRote({
    ...rote,
    authorid: openKey.userid,
  });

  return c.json(createResponse(result), 201);
});

// Retrieve notes using API key
router.get('/notes', isOpenKeyOk, async (c: HonoContext) => {
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');
  const tag = c.req.query('tag');

  const openKey = c.get('openKey');
  if (!openKey?.permissions.includes('GETROTE')) {
    throw new Error('API key permission does not match');
  }

  // 构建过滤器对象
  const filter: any = {};
  const query = c.req.query();

  // 处理标签过滤，过滤空白标签
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

  // 处理其他过滤参数
  Object.entries(query).forEach(([key, value]) => {
    if (!['skip', 'limit', 'archived', 'tag'].includes(key) && value !== undefined) {
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
router.get('/notes/search', isOpenKeyOk, queryTypeCheck, async (c: HonoContext) => {
  const keyword = c.req.query('keyword');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');
  const tag = c.req.query('tag');

  const openKey = c.get('openKey');
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

  // 处理标签过滤
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

  // 处理其他过滤参数
  Object.entries(query).forEach(([key, value]) => {
    if (!['skip', 'limit', 'archived', 'keyword', 'tag'].includes(key) && value !== undefined) {
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

export default router;
