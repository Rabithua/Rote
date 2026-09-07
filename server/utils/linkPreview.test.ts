import { describe, expect, test } from 'bun:test';
import { extractUrlsFromContent, getProxyUrl, parseLinkPreview } from './linkPreview';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(title = 'Fallback title') {
  return new Response(
    `<html><head><meta property="og:title" content="${title}"><meta property="og:description" content="Fallback description"></head></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

describe('link preview parsing', () => {
  test('extracts, normalizes, deduplicates, and limits note links', () => {
    expect(
      extractUrlsFromContent(
        'https://example.com/a#one https://example.com/a#two, https://example.com/b! https://example.com/c https://example.com/d'
      )
    ).toEqual(['https://example.com/a', 'https://example.com/b', 'https://example.com/c']);
  });

  test('parses Bilibili video metadata into the existing preview fields', async () => {
    const preview = await parseLinkPreview('https://www.bilibili.com/video/BV1xx411c7mD/', (async (
      input
    ) => {
      expect(String(input)).toContain('api.bilibili.com/x/web-interface/view?bvid=BV1xx411c7mD');
      return jsonResponse({
        code: 0,
        data: {
          title: 'A video',
          desc: 'Video description',
          pic: 'http://i0.hdslb.com/cover.jpg',
          owner: { name: 'Uploader' },
        },
      });
    }) as typeof fetch);

    expect(preview).toMatchObject({
      title: 'A video',
      description: 'Video description',
      image: 'https://i0.hdslb.com/cover.jpg',
      siteName: 'Bilibili · Uploader',
    });
  });

  test('resolves a Bilibili short link before requesting video metadata', async () => {
    const preview = await parseLinkPreview('https://b23.tv/example', (async (input) => {
      const url = String(input);
      if (url === 'https://b23.tv/example') {
        const response = new Response(null, { status: 302 });
        Object.defineProperty(response, 'url', {
          value: 'https://www.bilibili.com/video/BV1example/',
        });
        return response;
      }
      expect(url).toContain('api.bilibili.com/x/web-interface/view?bvid=BV1example');
      return jsonResponse({ code: 0, data: { title: 'Short-link video' } });
    }) as typeof fetch);
    expect(preview?.title).toBe('Short-link video');
    expect(preview?.url).toBe('https://b23.tv/example');
  });

  test('parses Hacker News story metadata', async () => {
    const preview = await parseLinkPreview('https://news.ycombinator.com/item?id=8863', (async (
      input
    ) => {
      expect(String(input)).toBe('https://hacker-news.firebaseio.com/v0/item/8863.json');
      return jsonResponse({ title: 'A launch', by: 'author', score: 104, descendants: 71 });
    }) as typeof fetch);

    expect(preview).toMatchObject({
      title: 'A launch',
      description: '104 ↑ · 71 💬',
      siteName: 'Hacker News · author',
    });
  });

  test('parses arXiv title, authors, and summary', async () => {
    const preview = await parseLinkPreview('https://arxiv.org/pdf/1706.03762.pdf', (async (
      input
    ) => {
      expect(String(input)).toBe('https://export.arxiv.org/api/query?id_list=1706.03762');
      return new Response(
        `<?xml version="1.0"?><feed><entry><title> Attention &amp; Models </title><summary> Paper summary. </summary><author><name>Alice</name></author><author><name>Bob</name></author></entry></feed>`,
        { headers: { 'content-type': 'application/atom+xml' } }
      );
    }) as typeof fetch);

    expect(preview).toMatchObject({
      title: 'Attention & Models',
      description: 'Paper summary.',
      siteName: 'arXiv · Alice, Bob',
    });
  });

  test('keeps the existing Bluesky proxy behavior', async () => {
    const original = 'https://bsky.app/profile/example.com/post/abc';
    expect(getProxyUrl(original)).toBe('https://fxbsky.app/profile/example.com/post/abc');
    const preview = await parseLinkPreview(original, (async (input) => {
      expect(String(input)).toBe('https://fxbsky.app/profile/example.com/post/abc');
      return htmlResponse('A Bluesky post');
    }) as typeof fetch);
    expect(preview?.title).toBe('A Bluesky post');
    expect(preview?.url).toBe(original);
  });

  test('omits the Bluesky card when its existing proxy cannot provide metadata', async () => {
    const preview = await parseLinkPreview(
      'https://bsky.app/profile/example.com/post/missing',
      (async (input) => {
        expect(String(input)).toBe('https://fxbsky.app/profile/example.com/post/missing');
        return new Response(null, { status: 503 });
      }) as typeof fetch
    );
    expect(preview).toBeNull();
  });

  test.each([
    'https://www.bilibili.com/video/BV1xx411c7mD/',
    'https://news.ycombinator.com/item?id=8863',
    'https://arxiv.org/abs/1706.03762',
  ])('falls back to ordinary page metadata when special parsing fails: %s', async (url) => {
    const preview = await parseLinkPreview(url, (async (input) =>
      String(input) === url ? htmlResponse() : jsonResponse({}, 503)) as typeof fetch);
    expect(preview).toMatchObject({
      url,
      title: 'Fallback title',
      description: 'Fallback description',
    });
  });
});
