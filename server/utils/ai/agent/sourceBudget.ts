import type { SemanticSearchResult } from '../../dbMethods/ai';
import type { RoteAgentSourceRegistration } from './types';

// Lower bound for a one-character note with the smallest valid source envelope.
export const MIN_EVIDENCE_MESSAGE_CHARS = Array.from(
  JSON.stringify({
    status: 'ok',
    foundCount: 1,
    sources: [
      {
        citation: 1,
        sourceType: 'rote',
        sourceId: '00000000-0000-4000-8000-000000000001',
        excerpt: 'x',
        truncated: false,
      },
    ],
  })
).length;
export const sourceKey = (source: SemanticSearchResult) =>
  `${source.sourceType}:${source.sourceId}`;
export const unicodeLength = (value: string) => Array.from(value).length;
export const unicodeSlice = (value: string, start: number, end?: number) =>
  Array.from(value).slice(start, end).join('');

/** Run-local reference registry and accounting of final serialized evidence messages. */
export class AgentSourceBudget {
  private readonly maxSourceChars: number;
  private readonly sourceKeys: string[];
  private readonly sourcesByKey = new Map<string, SemanticSearchResult>();
  private sourceCharsUsed: number;
  private readonly readOffsets: Record<string, number> = {};

  constructor(params: {
    maxSourceChars: number;
    sourceKeys?: string[];
    sourceCharsUsed?: number;
    readOffsets?: unknown;
  }) {
    this.maxSourceChars = Math.max(0, Math.floor(params.maxSourceChars));
    this.sourceKeys = Array.from(new Set(params.sourceKeys || []));
    const used = Number(params.sourceCharsUsed);
    this.sourceCharsUsed = Number.isFinite(used)
      ? Math.min(Math.max(Math.floor(used), 0), this.maxSourceChars)
      : 0;
    if (params.readOffsets && typeof params.readOffsets === 'object') {
      for (const [key, offset] of Object.entries(params.readOffsets)) {
        if (this.sourceKeys.includes(key) && Number.isSafeInteger(offset) && offset >= 0)
          this.readOffsets[key] = offset;
      }
    }
  }

  has(source: SemanticSearchResult): boolean {
    return this.sourceKeys.includes(sourceKey(source));
  }

  preview(sources: SemanticSearchResult[]): RoteAgentSourceRegistration[] {
    const keys = [...this.sourceKeys];
    return sources.map((source) => {
      const key = sourceKey(source);
      const existing = keys.indexOf(key);
      if (existing >= 0) return { index: existing + 1, source, isNew: false };
      keys.push(key);
      return { index: keys.length, source, isNew: true };
    });
  }

  commit(modelContent: string, sources: SemanticSearchResult[]): void {
    const chars = unicodeLength(modelContent);
    if (chars > this.snapshot().remainingSourceChars)
      throw new Error('Evidence text budget exceeded');
    this.sourceCharsUsed += chars;
    for (const source of sources) {
      const key = sourceKey(source);
      if (!this.sourceKeys.includes(key)) this.sourceKeys.push(key);
      this.sourcesByKey.set(key, source);
    }
  }

  readOffset(key: string): number {
    return this.readOffsets[key] || 0;
  }
  recordRead(key: string, offset: number): void {
    this.readOffsets[key] = offset;
  }
  readingState(): Record<string, number> {
    return { ...this.readOffsets };
  }
  list(): SemanticSearchResult[] {
    return this.sourceKeys
      .map((key) => this.sourcesByKey.get(key))
      .filter((source): source is SemanticSearchResult => Boolean(source));
  }
  keys(): string[] {
    return [...this.sourceKeys];
  }
  snapshot() {
    return {
      sourceCount: this.sourceKeys.length,
      sourceCharsUsed: this.sourceCharsUsed,
      maxSourceChars: this.maxSourceChars,
      remainingSourceChars: Math.max(0, this.maxSourceChars - this.sourceCharsUsed),
    };
  }
  exhausted(): boolean {
    return this.snapshot().remainingSourceChars < MIN_EVIDENCE_MESSAGE_CHARS;
  }
}
