/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import express from 'express';
import { createRote, findMyRote, searchMyRotes } from '../../utils/dbMethods';
import { asyncHandler } from '../../utils/handlers';
import { isOpenKeyOk, queryTypeCheck } from '../../utils/main';
import { NoteCreateZod, SearchKeywordZod } from '../../utils/zod';

declare module 'express-serve-static-core' {
  interface Request {
    openKey?: {
      id: string;
      userid: string;
      permissions: string[];
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }
}

/**
 * Standard response format
 * @param data Response data
 * @param message Response message
 * @param code Status code
 * @returns Standardized response object
 */
const createResponse = (data: any = null, message: string = 'success', code: number = 0) => {
  return {
    code,
    message,
    data,
  };
};

const router = express.Router();

// Create note using API key - GET method (kept for backward compatibility)
router.get(
  '/notes/create',
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tag, pin } = req.query;

    // 确保 content 是字符串类型
    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    // 验证输入长度（适配 query 参数）
    if (content.length > 1000000) {
      throw new Error('内容不能超过 1,000,000 个字符');
    }

    if (!req.openKey?.permissions.includes('SENDROTE')) {
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
      authorid: req.openKey.userid,
    });

    res.status(201).json(createResponse(result));
  })
);

// Create note using API key - POST method (proper RESTful interface)
router.post(
  '/notes',
  isOpenKeyOk,
  asyncHandler(async (req, res) => {
    const { content, state, type, tags, pin } = req.body;

    if (!content) {
      throw new Error('Content is required');
    }

    // 验证输入长度（验证整个 body，确保所有字段都被验证）
    NoteCreateZod.parse(req.body);

    if (!req.openKey?.permissions.includes('SENDROTE')) {
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
      authorid: req.openKey.userid,
    });

    res.status(201).json(createResponse(result));
  })
);

// Retrieve notes using API key
router.get(
  '/notes',
  isOpenKeyOk,
  asyncHandler(async (req, res) => {
    const { skip, limit, archived, tag, ...otherParams } = req.query;

    if (!req.openKey?.permissions.includes('GETROTE')) {
      throw new Error('API key permission does not match');
    }

    // 构建过滤器对象
    const filter: any = {};

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
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived'].includes(key) && value !== undefined) {
        filter[key] = value;
      }
    });

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    const rotes = await findMyRote(
      req.openKey.userid,
      parsedSkip,
      parsedLimit,
      filter,
      archived ? (archived === 'true' ? true : false) : undefined
    );

    res.status(200).json(createResponse(rotes));
  })
);

// Search notes using API key
router.get(
  '/notes/search',
  isOpenKeyOk,
  queryTypeCheck,
  asyncHandler(async (req, res) => {
    const { keyword, skip, limit, archived, tag, ...otherParams } = req.query;

    if (!req.openKey) {
      throw new Error('API key is required');
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('Keyword is required');
    }

    // 验证搜索关键词长度
    SearchKeywordZod.parse({ keyword });

    // 构建过滤器对象
    const filter: any = {};

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
    Object.entries(otherParams).forEach(([key, value]) => {
      if (!['skip', 'limit', 'archived', 'keyword'].includes(key) && value !== undefined) {
        filter[key] = value;
      }
    });

    const parsedSkip = typeof skip === 'string' ? parseInt(skip) : undefined;
    const parsedLimit = typeof limit === 'string' ? parseInt(limit) : undefined;

    const rotes = await searchMyRotes(
      req.openKey.userid,
      keyword,
      parsedSkip,
      parsedLimit,
      filter,
      archived ? (archived === 'true' ? true : false) : undefined
    );

    res.status(200).json(createResponse(rotes));
  })
);

export default router;
