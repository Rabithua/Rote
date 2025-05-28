/**
 * OpenKey API Router
 * Used to handle API key-based access
 */

import express from 'express';
import { createRote, findMyRote } from '../utils/dbMethods';
import { asyncHandler } from '../utils/handlers';
import { bodyTypeCheck, isOpenKeyOk, queryTypeCheck } from '../utils/main';

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
  '/notes',
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

    const rote = {
      content,
      state: state || 'private',
      type: type || 'rote',
      tags: Array.isArray(tag) ? tag : tag ? [tag] : [],
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
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const { content, state, type, tags, pin } = req.body;

    if (!content) {
      throw new Error('Content is required');
    }

    if (!req.openKey?.permissions.includes('SENDROTE')) {
      throw new Error('API key permission does not match');
    }

    const rote = {
      content,
      state: state || 'private',
      type: type || 'rote',
      tags: Array.isArray(tags) ? tags : tags ? tags.split(' ') : [],
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

export default router;
