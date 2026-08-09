import { describe, expect, it } from 'bun:test';
import { AgentSourceBudget } from '../utils/ai/agent/sourceBudget';
import type { SemanticSearchResult } from '../utils/dbMethods/ai';

function source(index: number, text = `source-${index}`): SemanticSearchResult {
  return {
    id: `source-${index}`,
    ownerId: 'owner',
    sourceType: 'rote',
    sourceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    chunkIndex: 0,
    text,
    similarity: 1 - index / 100,
    metadata: {},
  };
}

describe('agent source budget', () => {
  it('caps unique sources and keeps citation indexes stable', () => {
    const budget = new AgentSourceBudget({ maxSources: 20, maxSourceChars: 12_000 });
    const first = budget.register(Array.from({ length: 25 }, (_, index) => source(index + 1)));
    const duplicate = budget.register([
      { ...source(3, 'higher quality duplicate'), similarity: 2 },
    ]);

    expect(first).toHaveLength(20);
    expect(budget.snapshot().sourceCount).toBe(20);
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]).toMatchObject({ index: 3, isNew: false });
    expect(budget.list()[2].text).toBe('higher quality duplicate');
  });

  it('enforces one cumulative source text budget across calls', () => {
    const budget = new AgentSourceBudget({ maxSources: 20, maxSourceChars: 12_000 });
    const first = budget.consumeText('a'.repeat(8_000));
    const second = budget.consumeText('b'.repeat(8_000));
    const third = budget.consumeText('c');

    expect(first).toHaveLength(8_000);
    expect(second).toHaveLength(4_000);
    expect(third).toBe('');
    expect(budget.snapshot()).toMatchObject({
      sourceCharsUsed: 12_000,
      remainingSourceChars: 0,
    });
  });

  it('resumes source and text usage from a previous client-agent tool call', () => {
    const initialSources = Array.from({ length: 19 }, (_, index) => source(index + 1));
    const budget = new AgentSourceBudget({
      maxSources: 20,
      maxSourceChars: 12_000,
      sourceKeys: initialSources.map((item) => `${item.sourceType}:${item.sourceId}`),
      sourceCharsUsed: 11_990,
    });
    const registrations = budget.register([source(20), source(21)]);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({ index: 20, isNew: true });
    expect(budget.consumeText('x'.repeat(20))).toHaveLength(10);
    expect(budget.snapshot()).toMatchObject({
      sourceCount: 20,
      sourceCharsUsed: 12_000,
    });
  });
});
