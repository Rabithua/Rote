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
    expect(linkifyCitations('[1,2](https://example.com) [^1]', sources)).toBe(
      '[1,2](https://example.com) [^1]'
    );
  });
});
