export type LinkPreviewDraft = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  contentExcerpt: string | null;
  score: number;
};

type Fetcher = typeof fetch;

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function secureImageUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().replace(/^http:\/\//i, 'https://');
  }
  return null;
}

async function fetchJson(url: string, fetcher: Fetcher): Promise<unknown> {
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Rote-LinkPreview/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function directBilibiliVideoReference(url: URL): { key: 'aid' | 'bvid'; value: string } | null {
  if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]+|av(\d+))/i);
  if (!match) return null;
  return match[2] ? { key: 'aid', value: match[2] } : { key: 'bvid', value: match[1] };
}

async function bilibiliVideoReference(
  url: URL,
  fetcher: Fetcher
): Promise<{ key: 'aid' | 'bvid'; value: string } | null> {
  const direct = directBilibiliVideoReference(url);
  if (direct) return direct;
  if (!/(^|\.)b23\.tv$/i.test(url.hostname)) return null;
  try {
    const response = await fetcher(url, {
      headers: { 'User-Agent': 'Rote-LinkPreview/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    const resolved = safeUrl(response.url);
    return resolved ? directBilibiliVideoReference(resolved) : null;
  } catch {
    return null;
  }
}

async function parseBilibili(url: URL, fetcher: Fetcher): Promise<LinkPreviewDraft | null> {
  const reference = await bilibiliVideoReference(url, fetcher);
  if (!reference) return null;
  const endpoint = new URL('https://api.bilibili.com/x/web-interface/view');
  endpoint.searchParams.set(reference.key, reference.value);
  const payload = (await fetchJson(endpoint.toString(), fetcher)) as {
    code?: number;
    data?: {
      title?: unknown;
      desc?: unknown;
      pic?: unknown;
      owner?: { name?: unknown };
    };
  } | null;
  const data = payload?.code === 0 ? payload.data : null;
  if (!data || typeof data.title !== 'string' || !data.title.trim()) return null;
  const owner = typeof data.owner?.name === 'string' ? data.owner.name.trim() : '';
  const description = typeof data.desc === 'string' ? data.desc.trim() : '';
  return {
    url: url.toString(),
    title: data.title.trim(),
    description: description || null,
    image: secureImageUrl(data.pic),
    siteName: owner ? `Bilibili · ${owner}` : 'Bilibili',
    contentExcerpt: description || data.title.trim(),
    score: 100,
  };
}

async function parseHackerNews(url: URL, fetcher: Fetcher): Promise<LinkPreviewDraft | null> {
  if (url.hostname.toLowerCase() !== 'news.ycombinator.com' || url.pathname !== '/item')
    return null;
  const id = url.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) return null;
  const payload = (await fetchJson(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    fetcher
  )) as {
    title?: unknown;
    by?: unknown;
    score?: unknown;
    descendants?: unknown;
  } | null;
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) return null;
  const author = typeof payload.by === 'string' ? payload.by.trim() : '';
  const score = typeof payload.score === 'number' ? payload.score : 0;
  const comments = typeof payload.descendants === 'number' ? payload.descendants : 0;
  const summary = `${score} ↑ · ${comments} 💬`;
  return {
    url: url.toString(),
    title: payload.title.trim(),
    description: summary,
    image: null,
    siteName: author ? `Hacker News · ${author}` : 'Hacker News',
    contentExcerpt: summary,
    score: 90,
  };
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function xmlText(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]).replace(/\s+/g, ' ').trim() || null : null;
}

async function parseArxiv(url: URL, fetcher: Fetcher): Promise<LinkPreviewDraft | null> {
  if (!/(^|\.)arxiv\.org$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/i);
  if (!match) return null;
  const id = match[1];
  let response: Response;
  try {
    response = await fetcher(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
      {
        headers: { Accept: 'application/atom+xml', 'User-Agent': 'Rote-LinkPreview/1.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const xml = await response.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) return null;
  const title = xmlText(entry, 'title');
  if (!title) return null;
  const description = xmlText(entry, 'summary');
  const authors = Array.from(entry.matchAll(/<author>([\s\S]*?)<\/author>/gi))
    .map((author) => xmlText(author[1], 'name'))
    .filter((author): author is string => Boolean(author));
  return {
    url: url.toString(),
    title,
    description,
    image: null,
    siteName: authors.length ? `arXiv · ${authors.slice(0, 3).join(', ')}` : 'arXiv',
    contentExcerpt: description || title,
    score: 90,
  };
}

export async function parseSpecialLinkPreview(
  rawUrl: string,
  fetcher: Fetcher = fetch
): Promise<LinkPreviewDraft | null> {
  const url = safeUrl(rawUrl);
  if (!url) return null;
  try {
    return (
      (await parseBilibili(url, fetcher)) ||
      (await parseHackerNews(url, fetcher)) ||
      (await parseArxiv(url, fetcher))
    );
  } catch {
    return null;
  }
}
