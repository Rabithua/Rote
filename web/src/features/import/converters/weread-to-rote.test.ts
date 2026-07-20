import { beforeEach, describe, expect, it, vi } from 'vitest';

import { convertWereadToRote, isWereadSourceData } from './weread-to-rote';
import type { WereadSourceData } from './types';

const source: WereadSourceData = {
  meta: {
    bookId: 'book-1',
    title: '测试之书',
    category: '文学',
  },
  content: [
    {
      chapterUid: 1,
      chapterTitle: '第一章',
      items: [
        {
          type: 'highlight',
          bookmarkId: 'bookmark-1',
          markText: '值得记住的 #句子',
          createTime: 1_700_000_000,
        },
        {
          type: 'review',
          reviewId: 'review-1',
          abstract: '书中的原文',
          content: '我的 #想法',
          createTime: 1_700_000_100,
        },
      ],
    },
  ],
};

describe('WeRead converter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  it('validates structured and copied-text exports', () => {
    expect(isWereadSourceData(source)).toBe(true);
    expect(
      isWereadSourceData({
        text: '测试之书\n测试作者\n2个笔记\n\n◆ 第一章\n\n>> 一条划线',
      })
    ).toBe(true);
    expect(isWereadSourceData({ text: '普通文本' })).toBe(false);
  });

  it('converts highlights and thoughts with stable source identities', () => {
    const first = convertWereadToRote(source);
    const second = convertWereadToRote(source);

    expect(first.success).toBe(true);
    expect(first.data?.notes).toHaveLength(2);
    expect(first.data?.notes[0]).toMatchObject({
      title: '测试之书 · 第一章',
      content: '值得记住的 #句子',
      tags: ['微信读书', '测试之书', '文学', '句子'],
      createdAt: '2023-11-14T22:13:20.000Z',
      source: { provider: 'weread' },
    });
    expect(first.data?.notes[1].content).toBe('> 书中的原文\n\n我的 #想法');
    expect(first.data?.notes.map((note) => note.source)).toEqual(
      second.data?.notes.map((note) => note.source)
    );
  });

  it('converts a multi-book official API result', () => {
    const result = convertWereadToRote({
      books: [source, { ...source, meta: { bookId: 'book-2', title: '第二本书' } }],
    });

    expect(result.stats.converted).toBe(4);
    expect(result.data?.notes[2].title).toBe('第二本书 · 第一章');
  });

  it('removes image placeholders while preserving useful text', () => {
    const result = convertWereadToRote({
      meta: { title: '图文测试' },
      content: [
        {
          items: [
            {
              type: 'highlight',
              bookmarkId: 'mixed',
              markText: '图前文字[插图]\n[图片]图后文字',
            },
            {
              type: 'review',
              reviewId: 'thought',
              abstract: '[插图]',
              content: '这是我对插图的想法',
            },
          ],
        },
      ],
    });

    expect(result.data?.notes.map((note) => note.content)).toEqual([
      '图前文字\n图后文字',
      '这是我对插图的想法',
    ]);
    expect(result.stats.localAttachmentsSkipped).toBe(3);
    expect(result.warnings).toHaveLength(1);
  });

  it('skips image-only notes without exporting placeholder content', () => {
    const result = convertWereadToRote({
      meta: { title: '图文测试' },
      content: [
        {
          items: [
            { type: 'highlight', bookmarkId: 'image', markText: '[插图]' },
            { type: 'highlight', bookmarkId: 'text', markText: '保留文字' },
          ],
        },
      ],
    });

    expect(result.data?.notes.map((note) => note.content)).toEqual(['保留文字']);
    expect(result.stats).toMatchObject({ total: 2, converted: 1 });
  });

  it('reports a failed conversion when every note is image-only', () => {
    const result = convertWereadToRote({
      meta: { title: '只有图片' },
      content: [{ items: [{ type: 'highlight', markText: '[插图]' }] }],
    });

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.stats).toMatchObject({
      total: 1,
      converted: 0,
      failed: 1,
      localAttachmentsSkipped: 1,
    });
  });

  it('parses copied text and falls back to the current time', () => {
    const result = convertWereadToRote({
      text: [
        '卡片笔记写作法',
        '申克·阿伦斯',
        '2个笔记',
        '',
        '◆ 中文版序',
        '',
        '这是我的想法',
        '',
        '>> 引用文字',
      ].join('\n'),
    });

    expect(result.data?.notes.map((note) => note.content)).toEqual(['这是我的想法', '引用文字']);
    expect(result.data?.notes[0].createdAt).toBe('2025-01-01T00:00:00.000Z');
  });
});
