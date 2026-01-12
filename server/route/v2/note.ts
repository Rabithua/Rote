import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { authenticateJWT, optionalJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import {
  bindAttachmentsToRote,
  createRote,
  deleteRote,
  deleteRoteAttachmentsByRoteId,
  editRote,
  findMyRandomRote,
  findMyRote,
  findPublicRote,
  findRandomPublicRote,
  findRoteById,
  findRotesByIds,
  findUserPublicRote,
  getUserInfoByUsername,
  searchMyRotes,
  searchPublicRotes,
  searchUserPublicRotes,
  setNoteArticleId,
} from '../../utils/dbMethods';
import { bodyTypeCheck, createResponse, isValidUUID } from '../../utils/main';
import { NoteCreateZod, NoteUpdateZod, SearchKeywordZod } from '../../utils/zod';

// 笔记相关路由
const notesRouter = new Hono<{ Variables: HonoVariables }>();

// 创建笔记
notesRouter.post('/', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const body = await c.req.json();
  // 验证输入长度
  NoteCreateZod.parse(body);

  const { title, content, type, tags, state, archived, pin, editor, attachmentIds } = body as {
    title?: string;
    content: string;
    type?: string;
    tags?: string[];
    state?: string;
    archived?: boolean;
    pin?: boolean;
    editor?: string;
    attachmentIds?: string[];
    articleId?: string;
    articleIds?: string[]; // 兼容旧客户端：严格单篇后最多 1 个
  };
  const user = c.get('user') as User;

  if (!content) {
    throw new Error('Content is required');
  }

  const rote = await createRote({
    title,
    content,
    type,
    tags,
    state,
    pin: !!pin,
    editor,
    archived: !!archived,
    authorid: user.id,
  });

  // 如果传入了附件ID，则绑定到新建的笔记
  if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
    await bindAttachmentsToRote(user.id, rote.id, attachmentIds);
  }

  // 绑定文章（优先 articleId；兼容 articleIds，取第一个）
  const articleIdToSet =
    typeof (body as any).articleId === 'string'
      ? (body as any).articleId
      : Array.isArray((body as any).articleIds) && (body as any).articleIds.length > 0
        ? (body as any).articleIds[0]
        : null;
  if (articleIdToSet) {
    await setNoteArticleId(rote.id, articleIdToSet, user.id);
  }

  // 重新查询以获取最新关联数据（附件/文章等）
  const fullRote = await findRoteById(rote.id);
  return c.json(createResponse(fullRote), 201);
});

// 获取随机笔记 - 移到前面避免被当作ID匹配
notesRouter.get('/random', optionalJWT, async (c: HonoContext) => {
  const user = c.get('user') as User | undefined;
  let rote: any;

  if (user) {
    rote = await findMyRandomRote(user.id);
  } else {
    rote = await findRandomPublicRote();
  }

  return c.json(createResponse(rote), 200);
});

// 搜索当前用户的笔记
notesRouter.get('/search', authenticateJWT, async (c: HonoContext) => {
  const keyword = c.req.query('keyword');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');
  const user = c.get('user') as User;

  // 验证搜索关键词长度
  if (keyword && typeof keyword === 'string') {
    SearchKeywordZod.parse({ keyword });
  } else {
    throw new Error('Keyword is required');
  }

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
    user.id,
    keyword,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rotes), 200);
});

// 搜索公开笔记
notesRouter.get('/search/public', async (c: HonoContext) => {
  const keyword = c.req.query('keyword');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');

  // 验证搜索关键词长度
  if (keyword && typeof keyword === 'string') {
    SearchKeywordZod.parse({ keyword });
  } else {
    throw new Error('Keyword is required');
  }

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
  const excludedKeys = ['skip', 'limit', 'keyword', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  const rotes = await searchPublicRotes(keyword, parsedSkip, parsedLimit, filter);

  return c.json(createResponse(rotes), 200);
});

// 搜索指定用户的公开笔记
notesRouter.get('/search/users/:username', async (c: HonoContext) => {
  const username = c.req.param('username');
  const keyword = c.req.query('keyword');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');
  const tag = c.req.query('tag');

  if (!username) {
    throw new Error('Username is required');
  }

  // 验证搜索关键词长度
  if (keyword && typeof keyword === 'string') {
    SearchKeywordZod.parse({ keyword });
  } else {
    throw new Error('Keyword is required');
  }

  // 构建过滤器对象
  const filter: any = {};
  const query = c.req.query();

  // 处理标签过滤（支持 tag 和 tag[] 两种格式）
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

  const userInfo = await getUserInfoByUsername(username);

  if (!userInfo.id) {
    throw new Error('Username not found');
  }

  const rotes = await searchUserPublicRotes(
    userInfo.id,
    keyword,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rotes), 200);
});

// 获取当前用户的笔记列表
notesRouter.get('/', authenticateJWT, async (c: HonoContext) => {
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');
  const user = c.get('user') as User;

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
  const excludedKeys = ['skip', 'limit', 'archived', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  const rote = await findMyRote(
    user.id,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rote), 200);
});

// 获取用户公开笔记
notesRouter.get('/users/:username', async (c: HonoContext) => {
  const username = c.req.param('username');
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');
  const archived = c.req.query('archived');

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
  const excludedKeys = ['skip', 'limit', 'archived', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  if (!username) {
    throw new Error('Username not found');
  }

  const userInfo = await getUserInfoByUsername(username);

  if (!userInfo.id) {
    throw new Error('Username not found');
  }

  const rote = await findUserPublicRote(
    userInfo.id,
    parsedSkip,
    parsedLimit,
    filter,
    archived ? (archived === 'true' ? true : false) : undefined
  );

  return c.json(createResponse(rote), 200);
});

// 获取所有公开笔记
notesRouter.get('/public', async (c: HonoContext) => {
  const skip = c.req.query('skip');
  const limit = c.req.query('limit');

  // 构建过滤器对象
  const filter: any = {};
  const query = c.req.query();

  // 处理标签过滤（支持 tag 和 tag[] 两种格式）
  const tag = c.req.query('tag') || c.req.query('tag[]');
  if (tag) {
    const tags = Array.isArray(tag) ? tag : [tag];
    if (tags.length > 0) {
      filter.tags = { hasEvery: tags };
    }
  }

  // 处理其他过滤参数（排除已知的查询参数和数组格式的 tag）
  const excludedKeys = ['skip', 'limit', 'tag', 'tag[]'];
  Object.entries(query).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== undefined) {
      filter[key] = value;
    }
  });

  const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
  const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

  const rote = await findPublicRote(parsedSkip, parsedLimit, filter);

  return c.json(createResponse(rote), 200);
});

// 批量获取笔记
notesRouter.post('/batch', optionalJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User | undefined;
  const body = await c.req.json();
  const { ids } = body as { ids: string[] };

  // 验证 ids 参数
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array');
  }

  // 去重并验证每个 id 的格式
  const uniqueIds = [...new Set(ids)];
  const invalidIds = uniqueIds.filter((id) => !isValidUUID(id));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid UUID format: ${invalidIds.join(', ')}`);
  }

  // 限制批量获取的数量，防止滥用
  if (uniqueIds.length > 100) {
    throw new Error('Maximum 100 notes can be requested at once');
  }

  // 批量获取笔记
  const rotes = await findRotesByIds(uniqueIds);

  // 权限过滤：只返回用户有权限访问的笔记
  const accessibleRotes = rotes.filter((rote) => {
    // 公开笔记，任何人都可以访问
    if (rote.state === 'public') {
      return true;
    }

    // 私有笔记，只有作者可以访问
    if (user && rote.authorid === user.id) {
      return true;
    }

    // 其他情况（私有笔记且不是作者），无权限访问
    return false;
  });

  // 按照请求的 ids 顺序排序返回结果
  const roteMap = new Map(accessibleRotes.map((rote) => [rote.id, rote]));
  const orderedRotes = uniqueIds.map((id) => roteMap.get(id)).filter((rote) => rote !== undefined);

  return c.json(createResponse(orderedRotes), 200);
});

// 获取笔记详情
notesRouter.get('/:id', optionalJWT, async (c: HonoContext) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');

  // UUID 格式验证
  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  const rote = await findRoteById(id);
  if (!rote) {
    throw new Error('Note not found');
  }

  if (rote.state === 'public') {
    return c.json(createResponse(rote), 200);
  }

  if (rote.authorid === user?.id) {
    return c.json(createResponse(rote), 200);
  }

  throw new Error('Access denied: note is private');
});

// 更新笔记
notesRouter.put('/:id', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  const body = await c.req.json();

  // 验证 ID 格式
  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing ID');
  }

  // 验证输入长度
  NoteUpdateZod.parse(body);

  // 确保使用路由参数中的 id，而不是 body 中的 id（防止不一致）
  await editRote({ ...body, id, authorid: user.id });

  // 更新文章绑定（优先 articleId；兼容 articleIds，取第一个）
  if (typeof (body as any).articleId === 'string' || (body as any).articleId === null) {
    await setNoteArticleId(id, (body as any).articleId ?? null, user.id);
  } else if (Array.isArray((body as any).articleIds)) {
    const articleIdToSet = (body as any).articleIds.length > 0 ? (body as any).articleIds[0] : null;
    await setNoteArticleId(id, articleIdToSet, user.id);
  }

  // 重新获取最新数据（包含更新后的 article）
  const data = await findRoteById(id);

  return c.json(createResponse(data), 200);
});

// 删除笔记
notesRouter.delete('/:id', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');

  const data = await deleteRote({ id, authorid: user.id });
  await deleteRoteAttachmentsByRoteId(id, user.id);

  return c.json(createResponse(data), 200);
});

export default notesRouter;
