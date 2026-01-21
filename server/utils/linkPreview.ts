import { upsertRoteLinkPreview } from './dbMethods/linkPreview';

const MAX_LINK_PREVIEWS = 3;
const FETCH_TIMEOUT_MS = 8000;
const MIN_SCORE = 40;

function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function extractUrlsFromContent(content: string): string[] {
  if (!content) return [];
  const urlMatches = content.match(/https?:\/\/[^\s)]+/g) || [];
  const cleaned = urlMatches
    .map((url) => url.replace(/[),.;!?]+$/, ''))
    .map((url) => normalizeUrl(url))
    .filter((url): url is string => Boolean(url));
  return Array.from(new Set(cleaned)).slice(0, MAX_LINK_PREVIEWS);
}

function extractMetaContent(html: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const match = html.match(regex);
  return match?.[1]?.trim() || null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function extractDescription(html: string): string | null {
  return (
    extractMetaContent(html, 'og:description') ||
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'twitter:description')
  );
}

function resolveUrl(baseUrl: string, value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function calculateScore(data: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
}): number {
  let score = 0;
  if (data.title) score += 40;
  if (data.description) score += data.description.length > 40 ? 40 : 20;
  if (data.image) score += 10;
  if (data.siteName) score += 10;
  return score;
}

function getProxyUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl);
    if (url.hostname === 'twitter.com' || url.hostname === 'www.twitter.com') {
      url.hostname = 'fxtwitter.com';
    } else if (url.hostname === 'x.com' || url.hostname === 'www.x.com') {
      url.hostname = 'fixupx.com';
    } else if (url.hostname === 'bsky.app' || url.hostname === 'www.bsky.app') {
      url.hostname = 'fxbsky.app';
    }
    return url.toString();
  } catch {
    return originalUrl;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const proxyUrl = getProxyUrl(url);
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Bot', // FxEmbed requires a bot-like UA or they might redirect normal users
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }
    return await response.text();
  } catch (_error: any) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseAndStoreRoteLinkPreviews(
  roteid: string,
  content: string
): Promise<void> {
  const urls = extractUrlsFromContent(content);
  if (urls.length === 0) {
    return;
  }

  await Promise.allSettled(
    urls.map(async (url) => {
      const html = await fetchHtml(url);
      if (!html) return;

      const title = extractMetaContent(html, 'og:title') || extractTitle(html);
      const description = extractDescription(html);
      const image = resolveUrl(url, extractMetaContent(html, 'og:image'));
      const siteName = extractMetaContent(html, 'og:site_name');
      const score = calculateScore({ title, description, image, siteName });

      if (score < MIN_SCORE) {
        return;
      }

      await upsertRoteLinkPreview({
        roteid,
        url,
        title,
        description,
        image,
        siteName,
        contentExcerpt: description || title || null,
        score,
      });
    })
  );
}
