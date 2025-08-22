import { User } from '@prisma/client';
import express from 'express';
import { authenticateJWT, optionalJWT } from '../../middleware/jwtAuth';
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
  findUserPublicRote,
  getUserInfoByUsername,
  searchMyRotes,
  searchPublicRotes,
  searchUserPublicRotes,
} from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { bodyTypeCheck, createResponse, isValidUUID } from '../../utils/main';

// 笔记相关路由
const notesRouter = express.Router();

// 创建笔记
notesRouter.post(
  '/',
  authenticateJWT,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const { title, content, type, tags, state, archived, pin, editor, attachmentIds } =
      req.body as {
        title?: string;
        content: string;
        type?: string;
        tags?: string[];
        state?: string;
        archived?: boolean;
        pin?: boolean;
        editor?: string;
        attachmentIds?: string[];
      };
    const user = req.user as User;

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

    // 重新读取，返回包含附件、作者、反应详情的完整对象
    const fullRote = await findRoteById(rote.id);
    res.status(201).json(createResponse(fullRote));
  })
);

// 获取随机笔记 - 移到前面避免被当作ID匹配
notesRouter.get(
  '/random',
  optionalJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    let rote;

    if (user) {
      rote = await findMyRandomRote(user.id);
    } else {
      rote = await findRandomPublicRote();
    }

    res.status(200).json(createResponse(rote));
  })
);

// 搜索当前用户的笔记
notesRouter.get(
  '/search',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { keyword, skip, limit, archived, tag, ...otherParams } = req.query;
    const user = req.user as User;

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Keyword is required');
    }

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived', 'keyword'].includes(key) && value !== undefined) {
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

    res.status(200).json(createResponse(rotes));
  })
);

// 搜索公开笔记
notesRouter.get(
  '/search/public',
  asyncHandler(async (req, res) => {
    const { keyword, skip, limit, tag, ...otherParams } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Keyword is required');
    }

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'keyword'].includes(key) && value !== undefined) {
        filter[key] = value;
      }
    });

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    const rotes = await searchPublicRotes(keyword, parsedSkip, parsedLimit, filter);

    res.status(200).json(createResponse(rotes));
  })
);

// 搜索指定用户的公开笔记
notesRouter.get(
  '/search/users/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    const { keyword, skip, limit, archived, tag, ...otherParams } = req.query;

    if (!username) {
      throw new Error('Username is required');
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Keyword is required');
    }

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived', 'keyword'].includes(key) && value !== undefined) {
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

    res.status(200).json(createResponse(rotes));
  })
);

// 获取当前用户的笔记列表
notesRouter.get(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { skip, limit, archived, tag, ...otherParams } = req.query;
    const user = req.user as User;

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived'].includes(key) && value !== undefined) {
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

    res.status(200).json(createResponse(rote));
  })
);

// 获取用户公开笔记
notesRouter.get(
  '/users/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    const { skip, limit, archived, tag, ...otherParams } = req.query;

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived'].includes(key) && value !== undefined) {
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

    res.status(200).json(createResponse(rote));
  })
);

// 获取所有公开笔记
notesRouter.get(
  '/public',
  asyncHandler(async (req, res) => {
    const { skip, limit, tag, ...otherParams } = req.query;

    // 构建过滤器对象
    const filter: any = {};

    // 处理标签过滤
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag];
      if (tags.length > 0) {
        filter.tags = { hasEvery: tags };
      }
    }

    // 处理其他过滤参数
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit'].includes(key) && value !== undefined) {
        filter[key] = value;
      }
    });

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    const rote = await findPublicRote(parsedSkip, parsedLimit, filter);

    res.status(200).json(createResponse(rote));
  })
);

// 获取笔记详情
notesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    // UUID 格式验证
    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid or missing ID');
    }

    const rote = await findRoteById(id);
    if (!rote) {
      throw new Error('Note not found');
    }

    if (rote.state === 'public') {
      res.status(200).json(createResponse(rote));
      return;
    }

    if (rote.authorid === user?.id) {
      res.status(200).json(createResponse(rote));
      return;
    }

    throw new Error('Access denied: note is private');
  })
);

// 更新笔记
notesRouter.put(
  '/:id',
  authenticateJWT,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const rote = req.body;
    const data = await editRote({ ...rote, authorid: user.id });

    res.status(200).json(createResponse(data));
  })
);

// 删除笔记
notesRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const id = req.params.id;

    const data = await deleteRote({ id, authorid: user.id });
    await deleteRoteAttachmentsByRoteId(id, user.id);

    res.status(200).json(createResponse(data));
  })
);

export default notesRouter;
