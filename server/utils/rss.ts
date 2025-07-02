import { User } from '@prisma/client';
import { Feed } from 'feed';

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
  notes: any[],
  user: User,
  options: RssFeedOptions,
  baseUrl: string
): Promise<string> {
  // 创建Feed实例
  const feed = new Feed({
    title: options.title,
    description: options.description,
    id: options.id,
    image: options.image,
    favicon: options.favicon,
    copyright: options.copyright,
    updated: notes.length > 0 ? new Date(notes[0].updatedAt) : new Date(),
    generator: 'Rote RSS Generator',
    author: {
      name: options.author.name,
      email: options.author.email,
      link: options.author.link,
    },
  });

  // 将笔记添加到Feed中
  for (const note of notes) {
    const noteUrl = `${baseUrl}/rote/${note.id}`;
    const content = note.content ? note.content.toString() : '';

    // 如果有content，则取content第一行作为title，否则用原有逻辑
    let title: string;
    if (note.title) {
      title = note.title.length > 12 ? note.title.slice(0, 12) + '…' : note.title;
    } else if (content.trim().length > 0) {
      // 按换行符分割，取第一行作为title
      const firstLine = content.split(/\r?\n/)[0].trim();
      title = firstLine.length > 12 ? firstLine.slice(0, 12) + '…' : firstLine;
    } else {
      title = 'Note';
    }

    // 将换行符替换为 <br />
    let htmlContent = content.replace(/\r?\n/g, '<br />');

    // 如果有附件，将图片添加到内容中
    if (note.attachments && note.attachments.length > 0) {
      note.attachments.forEach((attachment: any) => {
        if (
          attachment.url &&
          attachment.details &&
          attachment.details.mimetype?.startsWith('image/')
        ) {
          htmlContent += `<br /><img src="${attachment.url}" alt="Attachment Image" />`;
        }
      });
    }

    feed.addItem({
      title,
      id: note.id,
      link: noteUrl,
      description: note.type,
      image:
        note.attachments &&
        note.attachments.length > 0 &&
        note.attachments[0].details &&
        note.attachments[0].details.mimetype?.startsWith('image/')
          ? note.attachments[0].url
          : options.image,
      content: htmlContent,
      author: [
        {
          name: note.author
            ? note.author.nickname || note.author.username
            : user.nickname || user.username,
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
        noteTags.forEach((tag: any) => tags.add(tag));
      }
    });

    tags.forEach((tag) => {
      feed.addCategory(tag);
    });
  }

  // 返回RSS 2.0格式的输出
  return feed.rss2();
}
