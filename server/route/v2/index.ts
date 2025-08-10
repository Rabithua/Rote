import express from 'express';
import { getAllPublicRssData, getRssData } from '../../utils/dbMethods';

import { asyncHandler, errorHandler } from '../../utils/handlers';
import { createResponse } from '../../utils/main';
import { generateRssFeed, RssFeedOptions } from '../../utils/rss';
import apiKeysRouter from './apikey';
import attachmentsRouter from './attachment';
import authRouter from './auth';
import notesRouter from './note';
import notificationsRouter from './notification';
import openKeyRouter from './openKeyRouter';
import reactionsRouter from './reaction';
import siteRouter from './site';
import subscriptionsRouter from './subscription';
import usersRouter from './user';

const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.status(200).json(createResponse());
});

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
