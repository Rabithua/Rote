import { Hono } from 'hono';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getAllPublicRssData, getRssData } from '../../utils/dbMethods';
import { createResponse } from '../../utils/main';
import { generateRssFeed, type RssFeedOptions } from '../../utils/rss';
import adminRouter from './admin';
import apiKeysRouter from './apikey';
import articlesRouter from './article';
import attachmentsRouter from './attachment';
import authRouter from './auth';
import changeRouter from './change';
import notesRouter from './note';
import notificationsRouter from './notification';
import oauthRouter from './oauth';
import openKeyRouter from './openKeyRouter';
import reactionsRouter from './reaction';
import siteRouter from './site';
import subscriptionsRouter from './subscription';
import usersRouter from './user';

const router = new Hono<{ Variables: HonoVariables }>();

// 健康检查
router.get('/health', (c: HonoContext) => c.json(createResponse(), 200));

// 获取所有公开笔记的RSS
router.get('/rss/public', async (c: HonoContext) => {
  // Get all public RSS data
  const { notes } = await getAllPublicRssData();

  const dynamicApiUrl = c.get('dynamicApiUrl') || '';
  const dynamicFrontendUrl = c.get('dynamicFrontendUrl') || 'http://localhost:3001';

  // Set RSS feed options for public notes
  const feedOptions: RssFeedOptions = {
    title: 'Rote - 所有公开笔记',
    description: '这里是所有用户的公开笔记RSS订阅',
    id: 'public-notes',
    link: `${dynamicFrontendUrl}/explore`,
    feedLinks: {
      atom: `${dynamicApiUrl}/api/v2/rss/public`,
    },
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
  const feed = await generateRssFeed(notes, virtualUser as any, feedOptions, dynamicFrontendUrl);

  // Set proper Content-Type
  c.header('Content-Type', 'application/xml');
  return c.body(feed);
});

// RSS相关路由
router.get('/rss/:username', async (c: HonoContext) => {
  const username = c.req.param('username');

  if (!username) {
    throw new Error('Username is required');
  }

  // Get RSS data
  const { user, notes } = await getRssData(username);

  const dynamicApiUrl = c.get('dynamicApiUrl') || '';
  const dynamicFrontendUrl = c.get('dynamicFrontendUrl') || 'http://localhost:3001';

  // Set RSS feed options
  const feedOptions: RssFeedOptions = {
    title: `${user.nickname || user.username}`,
    description: user.description || `RSS feed for ${user.nickname || user.username}'s notes`,
    id: `${user.username}`,
    link: `${dynamicFrontendUrl}/${user.username}`,
    feedLinks: {
      atom: `${dynamicApiUrl}/api/v2/rss/${user.username}`,
    },
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
  const feed = await generateRssFeed(notes, user, feedOptions, dynamicFrontendUrl);

  // Set proper Content-Type
  c.header('Content-Type', 'application/xml');
  return c.body(feed);
});

// 注册子路由
router.route('/auth', authRouter);
router.route('/auth/oauth', oauthRouter);
router.route('/users', usersRouter);
router.route('/notes', notesRouter);
router.route('/articles', articlesRouter);
router.route('/reactions', reactionsRouter);
router.route('/notifications', notificationsRouter);
router.route('/subscriptions', subscriptionsRouter);
router.route('/api-keys', apiKeysRouter);
router.route('/attachments', attachmentsRouter);
router.route('/site', siteRouter);
router.route('/openkey', openKeyRouter);
router.route('/admin', adminRouter);
router.route('/changes', changeRouter);

export default router;
