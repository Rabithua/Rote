import type { SiteStatusData } from '@/hooks/useSiteStatus';
import type { Attachment } from '@/types/main';

/**
 * 获取当前站点的基础 URL
 * 优先使用 siteStatus.site.url，fallback 到 window.location.origin
 */
export function getBaseUrl(siteStatus: SiteStatusData | null): string {
  if (siteStatus?.site?.url) {
    return siteStatus.site.url;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

/**
 * 构建绝对 URL
 * 处理相对路径和绝对路径
 */
export function buildAbsoluteUrl(path: string, baseUrl: string): string {
  // 如果已经是绝对 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // 处理相对路径
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * 从 Markdown/HTML 内容中提取纯文本
 * 用于生成 description
 */
export function extractTextFromContent(content: string): string {
  if (!content) return '';

  let text = content;

  // 去除代码块（```...``` 或 ```...```）
  text = text.replace(/```[\s\S]*?```/g, '');
  // 去除行内代码（`...`）
  text = text.replace(/`[^`]*`/g, '');
  // 去除 HTML 标签
  text = text.replace(/<[^>]*>/g, '');
  // 去除 Markdown 链接 [text](url)
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 去除 Markdown 图片 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  // 去除 Markdown 标题标记（# ## ### 等）
  text = text.replace(/^#{1,6}\s+/gm, '');
  // 去除 Markdown 粗体/斜体标记（**text** 或 *text*）
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  // 去除 Markdown 删除线（~~text~~）
  text = text.replace(/~~([^~]+)~~/g, '$1');
  // 去除 Markdown 列表标记（- * + 或数字）
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  // 去除引用标记（>）
  text = text.replace(/^>\s+/gm, '');
  // 去除多余的空白字符和换行
  text = text.replace(/\s+/g, ' ').trim();
  // 去除首尾空白
  text = text.trim();

  return text;
}

/**
 * 截取文本到指定长度，添加省略号
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

/**
 * 获取附件的完整图片 URL
 * 处理 urlPrefix 和相对路径
 */
export function getImageUrl(
  attachment: Attachment | File | null | undefined,
  baseUrl: string,
  urlPrefix?: string
): string | null {
  if (!attachment) return null;

  // 如果是 File 对象，不是 Attachment
  if (attachment instanceof File) {
    return null;
  }

  // 检查是否是图片类型
  const mimetype = attachment.details?.mimetype || '';
  if (!mimetype.startsWith('image/')) {
    return null;
  }

  // 优先使用 compressUrl（如果存在）
  const imageUrl = attachment.compressUrl || attachment.url;
  if (!imageUrl) return null;

  // 如果已经是绝对 URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // 如果有 urlPrefix，优先使用
  if (urlPrefix) {
    const normalizedPrefix = urlPrefix.endsWith('/') ? urlPrefix.slice(0, -1) : urlPrefix;
    const normalizedPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${normalizedPrefix}${normalizedPath}`;
  }

  // 否则使用 baseUrl
  return buildAbsoluteUrl(imageUrl, baseUrl);
}

/**
 * 从笔记内容中提取标题
 * 优先使用 title 字段，否则使用内容的第一行
 */
export function extractTitle(rote: { title?: string; content: string }): string {
  if (rote.title) {
    return rote.title;
  }

  // 使用内容的第一行
  const firstLine = rote.content.split(/\r?\n/)[0].trim();
  if (firstLine) {
    // 去除 Markdown 标题标记
    return firstLine.replace(/^#{1,6}\s+/, '').trim();
  }

  return '';
}

/**
 * 获取语言代码对应的 Open Graph locale
 */
export function getOgLocale(language: string): string {
  const langMap: Record<string, string> = {
    zh: 'zh_CN',
    'zh-CN': 'zh_CN',
    'zh-TW': 'zh_TW',
    en: 'en_US',
    'en-US': 'en_US',
    'en-GB': 'en_GB',
    ja: 'ja_JP',
    'ja-JP': 'ja_JP',
  };

  return langMap[language] || 'en_US';
}
