import type { SemanticSearchResult } from '../../dbMethods/ai';
import type { RoteAgentSourceRegistration } from './types';

function sourceKey(source: SemanticSearchResult): string {
  return `${source.sourceType}:${source.sourceId}`;
}

function normalizeUsedChars(value: unknown, maxSourceChars: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.floor(numeric), 0), maxSourceChars);
}

export class AgentSourceBudget {
  private readonly maxSources: number;
  private readonly maxSourceChars: number;
  private readonly sourceKeys: string[];
  private readonly indexByKey = new Map<string, number>();
  private readonly sourcesByKey = new Map<string, SemanticSearchResult>();
  private sourceCharsUsed: number;

  constructor(params: {
    maxSources: number;
    maxSourceChars: number;
    sourceKeys?: string[];
    sourceCharsUsed?: number;
  }) {
    this.maxSources = Math.max(0, Math.floor(params.maxSources));
    this.maxSourceChars = Math.max(0, Math.floor(params.maxSourceChars));
    this.sourceKeys = Array.from(new Set(params.sourceKeys || [])).slice(0, this.maxSources);
    this.sourceKeys.forEach((key, index) => this.indexByKey.set(key, index + 1));
    this.sourceCharsUsed = normalizeUsedChars(params.sourceCharsUsed, this.maxSourceChars);
  }

  register(sources: SemanticSearchResult[]): RoteAgentSourceRegistration[] {
    const registrations: RoteAgentSourceRegistration[] = [];
    for (const source of sources) {
      const key = sourceKey(source);
      const existingIndex = this.indexByKey.get(key);
      if (existingIndex !== undefined) {
        const existing = this.sourcesByKey.get(key);
        if (!existing || source.similarity > existing.similarity)
          this.sourcesByKey.set(key, source);
        registrations.push({
          index: existingIndex,
          source: this.sourcesByKey.get(key) || source,
          isNew: false,
        });
        continue;
      }

      if (this.sourceKeys.length >= this.maxSources) continue;
      this.sourceKeys.push(key);
      const index = this.sourceKeys.length;
      this.indexByKey.set(key, index);
      this.sourcesByKey.set(key, source);
      registrations.push({ index, source, isNew: true });
    }
    return registrations;
  }

  consumeText(value: string, requestedChars = Number.POSITIVE_INFINITY): string {
    const remaining = this.maxSourceChars - this.sourceCharsUsed;
    if (remaining <= 0 || requestedChars <= 0) return '';
    const limit = Math.min(remaining, Math.max(0, Math.floor(requestedChars)));
    const consumed = value.slice(0, limit).trim();
    this.sourceCharsUsed += consumed.length;
    return consumed;
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
      maxSources: this.maxSources,
      sourceCharsUsed: this.sourceCharsUsed,
      maxSourceChars: this.maxSourceChars,
      remainingSources: Math.max(0, this.maxSources - this.sourceKeys.length),
      remainingSourceChars: Math.max(0, this.maxSourceChars - this.sourceCharsUsed),
    };
  }
}
