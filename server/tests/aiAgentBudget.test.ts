import { describe, expect, it } from 'bun:test';
import { deliverReadEvidence, deliverSearchEvidence } from '../utils/ai/agent/evidenceDelivery';
import { AgentSourceBudget, sourceKey, unicodeLength } from '../utils/ai/agent/sourceBudget';
import { DEFAULT_AGENT_POLICY, type RoteAgentContext } from '../utils/ai/agent/types';
import type { SemanticSearchResult } from '../utils/dbMethods/ai';

export function source(index: number, text = `note-${index}`): SemanticSearchResult {
  return {
    id: `source-${index}`,
    ownerId: 'owner',
    sourceType: 'rote',
    sourceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    chunkIndex: 0,
    text,
    similarity: 1,
    metadata: {},
  };
}
export function context(
  budget = new AgentSourceBudget({ maxSourceChars: 12000 })
): RoteAgentContext {
  return {
    userId: 'owner',
    requestId: 'run',
    request: { message: 'review' },
    config: {} as RoteAgentContext['config'],
    mode: 'review',
    policy: DEFAULT_AGENT_POLICY,
    state: {},
    emit: () => {},
    sourceBudget: budget,
  };
}

describe('serialized evidence budget', () => {
  it('delivers two batches of 20 and preserves numbering and duplicate references', () => {
    const ctx = context();
    const first = deliverSearchEvidence(
      ctx,
      Array.from({ length: 20 }, (_, i) => source(i + 1))
    );
    const second = deliverSearchEvidence(
      ctx,
      Array.from({ length: 20 }, (_, i) => source(i + 21))
    );
    expect(first.retrieval).toMatchObject({ addedCount: 20, totalCount: 20 });
    expect(second.retrieval).toMatchObject({ addedCount: 20, totalCount: 40 });
    expect(JSON.parse(second.modelContent).sources[0].citation).toBe(21);
    const duplicate = deliverSearchEvidence(ctx, [source(1)]);
    expect(duplicate.retrieval.addedCount).toBe(0);
    expect(ctx.sourceBudget.keys()).toHaveLength(40);
    expect(ctx.sourceBudget.snapshot().sourceCharsUsed).toBe(
      unicodeLength(first.modelContent) +
        unicodeLength(second.modelContent) +
        unicodeLength(duplicate.modelContent)
    );
  });
  it('counts metadata, JSON and Unicode; skips empty text without empty citations', () => {
    const ctx = context();
    const rows = Array.from({ length: 40 }, (_, i) => ({
      ...source(i + 1, '😀'.repeat(900)),
      metadata: { title: 'title'.repeat(200), tags: ['tag'.repeat(100)] },
    }));
    const first = deliverSearchEvidence(ctx, [source(999, ' '), ...rows]);
    expect(unicodeLength(first.modelContent)).toBeLessThanOrEqual(4000);
    for (const s of JSON.parse(first.modelContent).sources) {
      expect(unicodeLength(s.excerpt)).toBeGreaterThanOrEqual(80);
      expect(unicodeLength(s.excerpt)).toBeLessThanOrEqual(300);
      expect(s.truncated).toBe(true);
    }
    expect(ctx.sourceBudget.keys()).not.toContain(sourceKey(source(999)));
    const remainder = rows.filter((s) => !ctx.sourceBudget.has(s));
    const second = deliverSearchEvidence(ctx, remainder);
    expect(second.retrieval.addedCount).toBeGreaterThan(0);
    expect(JSON.parse(second.modelContent).sources[0].citation).toBe(first.sources.length + 1);
  });
  it('does not register evidence after exhaustion and does not overshoot the run limit', () => {
    const ctx = context(new AgentSourceBudget({ maxSourceChars: 12000, sourceCharsUsed: 11990 }));
    const result = deliverSearchEvidence(ctx, [source(1)]);
    expect(result.retrieval.budgetExhausted).toBe(true);
    expect(result.sources).toEqual([]);
    expect(ctx.sourceBudget.keys()).toEqual([]);
    expect(ctx.sourceBudget.snapshot().sourceCharsUsed).toBe(11990);
  });
  it('continues Unicode reads and restores run-local client state without repeating pages', () => {
    const ctx = context();
    const note = source(1);
    const text = '😀'.repeat(4500);
    const first = deliverReadEvidence(ctx, note, text, 0);
    const data = JSON.parse(first.modelContent);
    expect(data.nextOffset).toBe(2000);
    expect(data.truncated).toBe(true);
    const used = ctx.sourceBudget.snapshot().sourceCharsUsed;
    const duplicate = deliverReadEvidence(ctx, note, text, 0);
    expect(JSON.parse(duplicate.modelContent).status).toBe('no_new_content');
    expect(ctx.sourceBudget.snapshot().sourceCharsUsed).toBe(
      used + unicodeLength(duplicate.modelContent)
    );
    const restored = context(
      new AgentSourceBudget({
        maxSourceChars: 12000,
        sourceKeys: ctx.sourceBudget.keys(),
        sourceCharsUsed: ctx.sourceBudget.snapshot().sourceCharsUsed,
        readOffsets: ctx.sourceBudget.readingState(),
      })
    );
    const second = deliverReadEvidence(restored, note, text, data.nextOffset);
    expect(JSON.parse(second.modelContent)).toMatchObject({
      offset: 2000,
      nextOffset: 4000,
      truncated: true,
    });
    expect(second.retrieval).toMatchObject({ addedCount: 0, totalCount: 1 });
    expect(deliverReadEvidence(context(), note, text, 0).modelContent).toBe(first.modelContent);
  });
  it('registers complete short notes and rejects large serialized reads when no useful excerpt fits', () => {
    const ctx = context();
    const result = deliverSearchEvidence(ctx, [source(1, '短')]);
    expect(JSON.parse(result.modelContent).sources[0]).toMatchObject({
      excerpt: '短',
      truncated: false,
      citation: 1,
    });
    const tiny = context(new AgentSourceBudget({ maxSourceChars: 300 }));
    const result2 = deliverReadEvidence(
      tiny,
      { ...source(2), metadata: { title: 'x'.repeat(80) } },
      'body'.repeat(1000)
    );
    expect(result2.retrieval.budgetExhausted).toBe(true);
    expect(tiny.sourceBudget.keys()).toHaveLength(0);
  });
});
