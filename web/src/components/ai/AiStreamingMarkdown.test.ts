import type { AiSemanticResult } from '@/utils/aiApi';
import { describe, expect, it } from 'vitest';
import { linkifyCitations } from './AiStreamingMarkdown';

const sources = [
  {
    sourceType: 'rote',
    sourceId: 'rote-1',
    similarity: 1,
    text: 'First source',
  },
  {
    sourceType: 'article',
    sourceId: 'article-2',
    similarity: 1,
    metadata: { title: 'Second source' },
  },
] as AiSemanticResult[];

describe('linkifyCitations', () => {
  it('linkifies every adjacent citation shown in the memory reply', () => {
    const replySources = Array.from({ length: 30 }, (_, index) => ({
      sourceType: 'rote' as const,
      sourceId: `rote-${index + 1}`,
      similarity: 1,
      text: `Source ${index + 1}`,
      metadata: {},
    }));

    expect(linkifyCitations('Answer [3][9][6]. More [30][10][15].', replySources)).toBe(
      'Answer [\\[3\\]](/rote/rote-3 "Source 3")[\\[9\\]](/rote/rote-9 "Source 9")[\\[6\\]](/rote/rote-6 "Source 6"). More [\\[30\\]](/rote/rote-30 "Source 30")[\\[10\\]](/rote/rote-10 "Source 10")[\\[15\\]](/rote/rote-15 "Source 15").'
    );
  });

  it('linkifies adjacent groups while preserving separators and unknown citations', () => {
    expect(linkifyCitations('Answer [1, 2][99][1] [2].', sources)).toBe(
      'Answer [\\[1\\]](/rote/rote-1 "First source"), [\\[2\\]](/article/article-2 "Second source")[99][\\[1\\]](/rote/rote-1 "First source") [\\[2\\]](/article/article-2 "Second source").'
    );
  });

  it('linkifies every citation in a comma-separated group', () => {
    expect(linkifyCitations('Answer [1,2].', sources)).toBe(
      'Answer [\\[1\\]](/rote/rote-1 "First source"),[\\[2\\]](/article/article-2 "Second source").'
    );
  });

  it('preserves group separators and unsupported citation numbers', () => {
    expect(linkifyCitations('Answer [1, 99，2].', sources)).toBe(
      'Answer [\\[1\\]](/rote/rote-1 "First source"), [99]，[\\[2\\]](/article/article-2 "Second source").'
    );
  });

  it('does not rewrite existing markdown links or footnotes', () => {
    expect(
      linkifyCitations(
        '[1,2](https://example.com) [1,2][details] [1][] [[1]] [^1]\n\n[details]: https://example.com',
        sources
      )
    ).toBe(
      '[1,2](https://example.com) [1,2][details] [1][] [[1]] [^1]\n\n[details]: https://example.com'
    );
  });

  it('does not rewrite citations inside inline or fenced code', () => {
    const content = 'Use `[1,2]` here.\n\n```ts\nconst sourceIds = [1,2];\n```\n\nCite [1,2].';

    expect(linkifyCitations(content, sources)).toBe(
      'Use `[1,2]` here.\n\n```ts\nconst sourceIds = [1,2];\n```\n\nCite [\\[1\\]](/rote/rote-1 "First source"),[\\[2\\]](/article/article-2 "Second source").'
    );
  });

  it('escapes quotes and backslashes in source titles', () => {
    const quotedSources = [
      {
        ...sources[0],
        metadata: { title: 'He said "hello" from C:\\notes' },
      },
    ];

    expect(linkifyCitations('Answer [1].', quotedSources)).toBe(
      'Answer [\\[1\\]](/rote/rote-1 "He said \\"hello\\" from C:\\\\notes").'
    );
  });
});
