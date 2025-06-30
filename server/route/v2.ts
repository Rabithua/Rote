import { User } from '@prisma/client';
import express from 'express';
import formidable from 'formidable';
import passport from 'passport';
import {
  addReaction,
  addSubScriptionToUser,
  changeUserPassword,
  createAttachments,
  createRote,
  createUser,
  deleteAttachment,
  deleteAttachments,
  deleteMyOneOpenKey,
  deleteRefreshToken,
  deleteRote,
  deleteRoteAttachmentsByRoteId,
  deleteSubScription,
  editMyOneOpenKey,
  editMyProfile,
  editRote,
  exportData,
  findMyRandomRote,
  findMyRote,
  findPublicRote,
  findRandomPublicRote,
  findRefreshToken,
  findRoteById,
  findSubScriptionToUser,
  findSubScriptionToUserByendpoint,
  findSubScriptionToUserByUserId,
  findUserPublicRote,
  generateOpenKey,
  getAllPublicRssData,
  getHeatMap,
  getMyOpenKey,
  getMyTags,
  getRssData,
  getSiteMapData,
  getStatus,
  getUserInfoByUsername,
  removeReaction,
  saveRefreshToken,
  searchMyRotes,
  searchPublicRotes,
  searchUserPublicRotes,
  statistics,
  updateSubScription,
} from '../utils/dbMethods';
import webpush from '../utils/webpush';

import { randomUUID } from 'crypto';
import moment from 'moment';
import { authenticateJWT, optionalJWT } from '../middleware/jwtAuth';
import { scheduleNoteOnceNoticeJob } from '../schedule/NoteOnceNoticeJob';
import { UploadResult } from '../types/main';
import { JobNames } from '../types/schedule';
import { asyncHandler, errorHandler } from '../utils/handlers';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { bodyTypeCheck, isValidUUID, sanitizeUserData } from '../utils/main';
import { r2uploadhandler } from '../utils/r2';
import { generateRssFeed, RssFeedOptions } from '../utils/rss';
import { passwordChangeZod, RegisterDataZod } from '../utils/zod';
import openKeyRouter from './openKeyRouter';

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

// 健康检查
router.get('/health', (req, res) => {
  res.status(200).json(createResponse());
});

// 认证相关路由
const authRouter = express.Router();

// 注册
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { username, password, email, nickname } = req.body;

    RegisterDataZod.parse(req.body);

    const user = await createUser({
      username,
      password,
      email,
      nickname,
    });

    if (!user.id) {
      throw new Error('Registration failed, username or email already exists');
    }

    res.status(201).json(createResponse(user));
  })
);

// 登录 (使用JWT认证)
authRouter.post(
  '/login',
  asyncHandler(async (req, res, next) => {
    passport.authenticate('local', async (err: any, user: User, data: any) => {
      if (err || !user) {
        next(new Error(data.message || 'Authentication failed'));
        return;
      }

      try {
        // 生成 JWT tokens (完全无状态，不存储到数据库)
        const accessToken = await generateAccessToken({
          userId: user.id,
          username: user.username,
        });
        const refreshToken = await generateRefreshToken({
          userId: user.id,
          username: user.username,
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7天
        await saveRefreshToken(user.id, refreshToken, expiresAt);

        res.status(200).json(
          createResponse(
            {
              user: sanitizeUserData(user),
              accessToken,
              refreshToken,
            },
            'Login successful'
          )
        );
      } catch (error) {
        next(new Error('Token generation failed'));
      }
    })(req, res, next);
  })
);

authRouter.post(
  '/logout',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) await deleteRefreshToken(refreshToken);
    res.status(200).json(createResponse(null, 'Logout success'));
  })
);

// 修改密码
authRouter.put(
  '/password',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { newpassword, oldpassword } = req.body;

    const zodData = passwordChangeZod.safeParse(req.body);
    if (zodData.success === false) {
      throw new Error(zodData.error.errors[0].message);
    }

    const updatedUser = await changeUserPassword(oldpassword, newpassword, user.id);
    res.status(200).json(createResponse(updatedUser));
  })
);

// Token 刷新端点
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json(createResponse(null, 'Refresh token required', 401));
    }

    try {
      const dbToken = await findRefreshToken(refreshToken);
      if (!dbToken || dbToken.expiresAt < new Date()) {
        if (dbToken) await deleteRefreshToken(refreshToken);
        return res.status(401).json(createResponse(null, 'Refresh token invalid or expired', 401));
      }

      const payload = await verifyRefreshToken(refreshToken);

      await deleteRefreshToken(refreshToken);

      const newAccessToken = await generateAccessToken({
        userId: payload.userId,
        username: payload.username,
      });
      const newRefreshToken = await generateRefreshToken({
        userId: payload.userId,
        username: payload.username,
      });
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7天
      await saveRefreshToken(payload.userId, newRefreshToken, expiresAt);

      res.status(200).json(
        createResponse(
          {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
          'Token refreshed successfully'
        )
      );
    } catch (error) {
      res.status(401).json(createResponse(null, 'Invalid refresh token', 401));
    }
  })
);

// 用户相关路由
const usersRouter = express.Router();

// 获取用户信息
usersRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    if (!username) {
      throw new Error('Username is required');
    }

    const data = await getUserInfoByUsername(username.toString());
    res.status(200).json(createResponse(data));
  })
);

// 获取当前用户个人资料
usersRouter.get(
  '/me/profile',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    res.status(200).json(createResponse(req.user as User));
  })
);

// 更新当前用户个人资料
usersRouter.put(
  '/me/profile',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await editMyProfile(user.id, req.body);

    res.status(200).json(createResponse(data));
  })
);

// 获取用户标签
usersRouter.get(
  '/me/tags',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await getMyTags(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 获取用户热力图数据
usersRouter.get(
  '/me/heatmap',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const data = await getHeatMap(user.id, startDate as string, endDate as string);
    res.status(200).json(createResponse(data));
  })
);

// 获取用户统计信息
usersRouter.get(
  '/me/statistics',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await statistics(user.id);

    res.status(200).json(createResponse(data));
  })
);

// 导出用户数据
usersRouter.get(
  '/me/export',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await exportData(user.id);

    const jsonData = JSON.stringify(data);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${user.username}-${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`
    );

    res.send(jsonData);
  })
);

// 笔记相关路由
const notesRouter = express.Router();

// 创建笔记
notesRouter.post(
  '/',
  authenticateJWT,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const { title, content, type, tags, state, archived, pin, editor } = req.body;
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

    res.status(201).json(createResponse(rote));
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

// 通知相关路由
const notificationsRouter = express.Router();

// 创建通知
notificationsRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { type } = req.body;

    switch (type) {
      case JobNames.NoteOnceNoticeJob:
        await scheduleNoteOnceNoticeJob(req.body);
        break;

      default:
        throw new Error('Invalid notification type');
    }

    res.status(201).json(createResponse());
  })
);

// 订阅相关路由
const subscriptionsRouter = express.Router();

// 添加订阅
subscriptionsRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const subscription = req.body;
    const user = req.user as User;

    if (!subscription) {
      throw new Error('Subscription information is required');
    }

    const existingSubscription = await findSubScriptionToUserByendpoint(subscription.endpoint);
    if (existingSubscription) {
      res.status(200).json(createResponse(existingSubscription));
      return;
    }

    const result = await addSubScriptionToUser(user.id, subscription);
    res.status(201).json(createResponse(result));
  })
);

// 获取用户订阅
subscriptionsRouter.get(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await findSubScriptionToUserByUserId(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 删除订阅
subscriptionsRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user as User;

    if (!id) {
      throw new Error('Subscription ID is required');
    }

    const subscription = await findSubScriptionToUser(id);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userid !== user.id) {
      throw new Error('User does not match');
    }

    const data = await deleteSubScription(id);
    res.status(200).json(createResponse(data));
  })
);

// 更新订阅
subscriptionsRouter.put(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user as User;
    const updateData = req.body;

    if (!id) {
      throw new Error('Subscription ID is required');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new Error('Update data is required');
    }

    const data = await updateSubScription(id, user.id, updateData);
    res.status(200).json(createResponse(data));
  })
);

// 批量测试所有端点
subscriptionsRouter.post(
  '/test-all',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;

    if (!webpush) {
      throw new Error('Valid keys not found');
    }

    // 获取用户所有订阅
    const subscriptions = await findSubScriptionToUserByUserId(user.id);

    const testResults: Array<{
      id: string;
      status: 'success' | 'failed';
      error?: string;
    }> = [];

    // 测试消息
    const testMessage = {
      title: '端点测试',
      body: '这是一条测试消息，用于验证端点是否可用。',
      image: `https://r2.rote.ink/others%2Flogo.png`,
      data: {
        type: 'test',
        url: 'https://rabithua.club',
      },
    };

    // 批量测试所有端点
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify(testMessage)
        );

        testResults.push({
          id: subscription.id,
          status: 'success',
        });

        // 如果测试成功且当前状态不是active，更新为active
        if (subscription.status !== 'active') {
          await updateSubScription(subscription.id, user.id, { status: 'active' });
        }
      } catch (error: any) {
        testResults.push({
          id: subscription.id,
          status: 'failed',
          error: error.message || 'Unknown error',
        });

        // 如果测试失败，更新状态为inactive
        await updateSubScription(subscription.id, user.id, { status: 'inactive' });
      }
    }

    res.status(200).json(
      createResponse({
        totalTested: subscriptions.length,
        results: testResults,
        summary: {
          success: testResults.filter((r) => r.status === 'success').length,
          failed: testResults.filter((r) => r.status === 'failed').length,
        },
      })
    );
  })
);

// 发送通知
subscriptionsRouter.post(
  '/:id/notify',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const message = req.body;

    if (!webpush) {
      throw new Error('Valid keys not found');
    }

    if (!id || !message) {
      throw new Error('Subscription ID and message are required');
    }

    const subscription = await findSubScriptionToUser(id);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    let result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify({ ...message })
    );

    res.status(200).json(createResponse(result, 'PWA Notification sent successfully'));
  })
);

// API密钥相关路由
const apiKeysRouter = express.Router();

// 生成API密钥
apiKeysRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await generateOpenKey(user.id);
    res.status(201).json(createResponse(data));
  })
);

// 获取所有API密钥
apiKeysRouter.get(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await getMyOpenKey(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 更新API密钥
apiKeysRouter.put(
  '/:id',
  authenticateJWT,
  bodyTypeCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;
    const { permissions } = req.body;

    if (!user.id) {
      throw new Error('User ID is required');
    }

    if (!id || !permissions) {
      throw new Error('API Key ID and permissions are required');
    }

    const data = await editMyOneOpenKey(user.id, id, permissions);
    res.status(200).json(createResponse(data));
  })
);

// 删除API密钥
apiKeysRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!user.id) {
      throw new Error('User ID is required');
    }

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid API Key ID');
    }

    const data = await deleteMyOneOpenKey(user.id, id);
    res.status(200).json(createResponse(data));
  })
);

// 附件相关路由
const attachmentsRouter = express.Router();

// 上传附件
attachmentsRouter.post(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { noteId } = req.query;

    const form = formidable({
      multiples: true,
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      maxFiles: 9,
      maxTotalFileSize: 100 * 1024 * 1024, // 100MB limit
      filename: () => {
        return `${randomUUID()}`;
      },
    });

    const [fields, files] = await form.parse(req);
    if (!files.images) {
      throw new Error('No images uploaded');
    }

    const imageFiles = Array.isArray(files.images) ? files.images : [files.images];

    const uploadResults: UploadResult[] = [];
    for (const file of imageFiles) {
      let r2_upload_result = await r2uploadhandler(file);
      if (r2_upload_result !== null) {
        uploadResults.push(r2_upload_result);
      }
    }

    const data = await createAttachments(user.id, noteId as string | undefined, uploadResults);

    res.status(201).json(createResponse(data));
  })
);

// 删除单个附件
attachmentsRouter.delete(
  '/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!id || !isValidUUID(id)) {
      throw new Error('Invalid attachment ID');
    }

    const data = await deleteAttachment(id, user.id);
    res.status(200).json(createResponse(data));
  })
);

// 批量删除附件
attachmentsRouter.delete(
  '/',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      throw new Error('No attachments to delete');
    }

    const data = await deleteAttachments(ids, user.id);
    res.status(200).json(createResponse(data));
  })
);

// 站点数据相关路由
const siteRouter = express.Router();

// 获取站点地图数据
siteRouter.get(
  '/sitemap',
  asyncHandler(async (req, res) => {
    const data = await getSiteMapData();
    res.status(200).json(createResponse(data));
  })
);

// 获取站点状态
siteRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    await getStatus();
    res.status(200).json(createResponse({}));
  })
);

// 反应相关路由
const reactionsRouter = express.Router();

// 为 reactions 路由添加可选JWT认证
reactionsRouter.use(optionalJWT);

// 添加反应
reactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { type, roteid, visitorId, visitorInfo, metadata } = req.body;

    if (!type || !roteid) {
      throw new Error('Type and rote ID are required');
    }

    // 验证 roteid 格式
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    // 检查笔记是否存在
    const rote = await findRoteById(roteid);
    if (!rote) {
      throw new Error('Rote not found');
    }

    // 构建反应数据
    const reactionData: any = {
      type,
      roteid,
      metadata,
    };

    if (user) {
      // 已登录用户
      reactionData.userid = user.id;
    } else {
      // 访客用户
      if (!visitorId) {
        throw new Error('Visitor ID is required for unauthenticated users');
      }
      reactionData.visitorId = visitorId;
      reactionData.visitorInfo = visitorInfo;
    }

    const reaction = await addReaction(reactionData);
    res.status(201).json(createResponse(reaction));
  })
);

// 删除反应
reactionsRouter.delete(
  '/:roteid/:type',
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { roteid, type } = req.params;
    const { visitorId } = req.query;

    if (!type || !roteid) {
      throw new Error('Type and rote ID are required');
    }

    // 验证 roteid 格式
    if (!isValidUUID(roteid)) {
      throw new Error('Invalid rote ID format');
    }

    // 构建删除条件
    const removeData: any = {
      type,
      roteid,
    };

    if (user) {
      removeData.userid = user.id;
    } else {
      if (!visitorId) {
        throw new Error('Visitor ID is required for unauthenticated users');
      }
      removeData.visitorId = visitorId as string;
    }

    const result = await removeReaction(removeData);
    res.status(200).json(createResponse(result));
  })
);

// 获取所有公开笔记的RSS
router.get(
  '/rss/public',
  asyncHandler(async (req, res) => {
    // Get all public RSS data
    const { notes } = await getAllPublicRssData();

    // Set RSS feed options for public notes
    const feedOptions: RssFeedOptions = {
      title: 'Rote - 所有公开笔记',
      description: '这里是所有用户的公开笔记RSS订阅',
      id: 'public-notes',
      link: `${req.dynamicApiUrl}/api/v2/rss/public`,
      copyright: `© ${new Date().getFullYear()} Rote`,
      author: {
        name: 'Rote',
        email: 'hello@rote.ink',
      },
    };

    // Create a virtual user object for the feed generation
    const virtualUser = {
      id: 'public',
      username: 'public',
      nickname: 'Rote',
      email: 'hello@rote.ink',
      avatar: null,
      description: 'All public notes from Rote users',
    };

    // Generate RSS feed
    const feed = await generateRssFeed(
      notes,
      virtualUser as any,
      feedOptions,
      req.dynamicFrontendUrl
    );

    // Set proper Content-Type
    res.setHeader('Content-Type', 'application/xml');
    res.send(feed);
  })
);

// RSS相关路由
router.get(
  '/rss/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
      throw new Error('Username is required');
    }

    // Get RSS data
    const { user, notes } = await getRssData(username);

    // Set RSS feed options
    const feedOptions: RssFeedOptions = {
      title: `${user.nickname || user.username}`,
      description: user.description || `RSS feed for ${user.nickname || user.username}'s notes`,
      id: `${user.username}`,
      link: `${req.dynamicApiUrl}/api/v2/rss/${user.username}`,
      favicon: user.avatar,
      copyright: `© ${new Date().getFullYear()} ${user.nickname || user.username}`,
      author: {
        name: user.nickname || user.username,
        email: user.email,
      },
    };

    // If user has an avatar, add it to the feed
    if (user.avatar) {
      feedOptions.image = user.avatar;
    }

    // Generate RSS feed
    const feed = await generateRssFeed(notes, user, feedOptions, req.dynamicFrontendUrl);

    // Set proper Content-Type
    res.setHeader('Content-Type', 'application/xml');
    res.send(feed);
  })
);

// 注册子路由
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/notes', notesRouter);
router.use('/reactions', reactionsRouter);
router.use('/notifications', notificationsRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/api-keys', apiKeysRouter);
router.use('/attachments', attachmentsRouter);
router.use('/site', siteRouter);
router.use('/openkey', openKeyRouter);

// 全局错误处理
router.use(errorHandler);

export default router;
