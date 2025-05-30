import { User } from '@prisma/client';
import express from 'express';
import formidable from 'formidable';
import passport from 'passport';
import {
  addSubScriptionToUser,
  changeUserPassword,
  createAttachments,
  createRote,
  createUser,
  deleteAttachment,
  deleteAttachments,
  deleteMyOneOpenKey,
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
  findRoteById,
  findSubScriptionToUser,
  findSubScriptionToUserByendpoint,
  findSubScriptionToUserByUserId,
  findUserPublicRote,
  generateOpenKey,
  getHeatMap,
  getMyOpenKey,
  getMySession,
  getMyTags,
  getRssData,
  getSiteMapData,
  getStatus,
  getUserInfoByUsername,
  searchMyRotes,
  searchPublicRotes,
  searchUserPublicRotes,
  statistics,
} from '../utils/dbMethods';
import webpush from '../utils/webpush';

import { randomUUID } from 'crypto';
import moment from 'moment';
import { scheduleNoteOnceNoticeJob } from '../schedule/NoteOnceNoticeJob';
import { UploadResult } from '../types/main';
import { JobNames } from '../types/schedule';
import { asyncHandler, errorHandler } from '../utils/handlers';
import { bodyTypeCheck, isAuthenticated, sanitizeUserData } from '../utils/main';
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

// 登录
authRouter.post(
  '/login',
  asyncHandler(async (req, res, next) => {
    passport.authenticate('local', (err: any, user: User, data: any) => {
      if (err || !user) {
        next(new Error(data.message || 'Authentication failed'));
        return;
      }

      req.logIn(user, (err) => {
        if (err) {
          next(new Error('Login failed'));
          return;
        }
        res.status(200).json(createResponse(sanitizeUserData(user)));
      });
    })(req, res, next);
  })
);

// 登出
authRouter.post(
  '/logout',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) reject(err);
        resolve();
      });
    });

    res.status(200).json(createResponse());
  })
);

// 修改密码
authRouter.put(
  '/password',
  isAuthenticated,
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
  isAuthenticated,
  asyncHandler(async (req, res) => {
    res.status(200).json(createResponse(req.user as User));
  })
);

// 更新当前用户个人资料
usersRouter.put(
  '/me/profile',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await editMyProfile(user.id, req.body);

    res.status(200).json(createResponse(data));
  })
);

// 获取当前用户会话
usersRouter.get(
  '/me/sessions',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    if (!user.id) {
      throw new Error('User ID is required');
    }

    const data = await getMySession(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 获取用户标签
usersRouter.get(
  '/me/tags',
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await statistics(user.id);

    res.status(200).json(createResponse(data));
  })
);

// 导出用户数据
usersRouter.get(
  '/me/export',
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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

    if (!id || id.length !== 24) {
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const data = await findSubScriptionToUserByUserId(user.id);
    res.status(200).json(createResponse(data));
  })
);

// 删除订阅
subscriptionsRouter.delete(
  '/:id',
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
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
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!user.id) {
      throw new Error('User ID is required');
    }

    if (!id || id.length !== 24) {
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
  isAuthenticated,
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
  isAuthenticated,
  asyncHandler(async (req, res) => {
    const user = req.user as User;
    const { id } = req.params;

    if (!id || id.length !== 24) {
      throw new Error('Invalid attachment ID');
    }

    const data = await deleteAttachment(id, user.id);
    res.status(200).json(createResponse(data));
  })
);

// 批量删除附件
attachmentsRouter.delete(
  '/',
  isAuthenticated,
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

// RSS相关路由
router.get(
  '/users/:username/rss',
  asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username) {
      throw new Error('Username is required');
    }

    // Get RSS data
    const { user, notes } = await getRssData(username);

    // Base URL from environment variable or default value
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Set RSS feed options
    const feedOptions: RssFeedOptions = {
      title: `${user.nickname || user.username}`,
      description: user.description || `RSS feed for ${user.nickname || user.username}'s notes`,
      id: `${user.username}`,
      link: `${baseUrl}/api/v2/users/${user.username}/rss`,
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
    const feed = await generateRssFeed(notes, user, feedOptions, baseUrl);

    // Set proper Content-Type
    res.setHeader('Content-Type', 'application/xml');
    res.send(feed);
  })
);

// 注册子路由
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/notes', notesRouter);
router.use('/notifications', notificationsRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/api-keys', apiKeysRouter);
router.use('/attachments', attachmentsRouter);
router.use('/site', siteRouter);
router.use('/openkey', openKeyRouter);

// 全局错误处理
router.use(errorHandler);

export default router;
