/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import express from 'express';
import { createRote, findMyRote, searchMyRotes } from '../utils/dbMethods';
import { asyncHandler } from '../utils/handlers';
import { isOpenKeyOk, queryTypeCheck } from '../utils/main';

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

    if (!content) {
      throw new Error('Content is required');
    }

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
        return [tags.trim()];
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
