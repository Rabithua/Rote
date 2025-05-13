import { Rote, User } from '@prisma/client';
import { Feed } from 'feed';
import moment from 'moment';

export interface RssFeedOptions {
  title: string;
  description: string;
  id: string;
  link: string;
  image?: string;
  favicon?: string;
  copyright: string;
  author: {
    name: string;
    email?: string;
    link?: string;
  };
}

/**
 * 生成用户笔记的RSS feed
 * @param notes 用户笔记列表
 * @param user 用户信息
 * @param options RSS配置选项
 * @param baseUrl 基础URL
 * @returns RSS Feed XML字符串
 */
export async function generateRssFeed(
  notes: Rote[],
  user: User,
  options: RssFeedOptions,
  baseUrl: string
): Promise<string> {
  // 创建Feed实例
  const feed = new Feed({
    title: options.title,
    description: options.description,
    id: options.id,
    link: options.link,
    image: options.image,
    favicon: options.favicon,
    copyright: options.copyright,
    updated: notes.length > 0 ? new Date(notes[0].updatedAt) : new Date(),
    generator: 'Rote RSS Generator',
    feedLinks: {
      rss2: `${baseUrl}/v1/api/rss/${user.username}`,
    },
    author: {
      name: options.author.name,
      email: options.author.email,
      link: options.author.link,
    },
  });

  // 将笔记添加到Feed中
  for (const note of notes) {
    const noteUrl = `${baseUrl}/note/${note.id}`;
    const content = note.content ? note.content.toString() : '';

    feed.addItem({
      title: note.title || moment(note.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      id: note.id,
      link: noteUrl,
      description: content.length > 200 ? content.substring(0, 200) + '...' : content,
      content: content,
      author: [
        {
          name: user.nickname || user.username,
          link: `${baseUrl}/user/${user.username}`,
        },
      ],
      date: new Date(note.updatedAt),
      published: new Date(note.createdAt),
    });
  }

  // 添加分类
  if (notes.length > 0) {
    const tags = new Set<string>();
    notes.forEach((note) => {
      if (note.tags) {
        const noteTags = Array.isArray(note.tags) ? note.tags : [];
        noteTags.forEach((tag) => tags.add(tag));
      }
    });

    tags.forEach((tag) => {
      feed.addCategory(tag);
    });
  }

  // 返回RSS 2.0格式的输出
  return feed.rss2();
}
