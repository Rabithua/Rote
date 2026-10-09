import { describe, expect, it, spyOn } from 'bun:test';
import { createAiUsageRecorder } from './recording';
import { readAiUsage } from './values';
import { parseAiUsageFilters } from './filters';
import type { AiUsageRecord } from './types';

const provider = {
  providerId: 'deepseek',
  model: 'deepseek-flash',
  baseUrl: 'http://provider.test',
};

describe('AI usage recording', () => {
  it('keeps the latest cumulative usage without double counting or adding detail subsets', async () => {
    const records: AiUsageRecord[] = [];
    const recorder = createAiUsageRecorder(
      provider,
      'chat',
      { userId: 'requester', purpose: 'chat_plan' },
      async (record) => {
        records.push(record);
      }
    );
    recorder.dispatch();
    recorder.observe({ prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 });
    recorder.observe({
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_cache_hit_tokens: 80,
      prompt_cache_miss_tokens: 20,
      completion_tokens_details: { reasoning_tokens: 15 },
    });
    recorder.observe({});
    await recorder.finish('failed');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      userid: 'requester',
      purpose: 'chat_plan',
      totalTokens: 120,
      cacheHitTokens: 80,
      cacheMissTokens: 20,
      reasoningTokens: 15,
      status: 'failed',
      usageStatus: 'reported',
    });
  });

  it('does not log local validation failures, and leaves missing usage nullable', async () => {
    const records: AiUsageRecord[] = [];
    const recorder = createAiUsageRecorder(provider, 'embedding', undefined, async (record) => {
      records.push(record);
    });
    await recorder.finish('failed');
    expect(records).toHaveLength(0);
    recorder.dispatch();
    recorder.observe({});
    await recorder.finish('cancelled');
    expect(records[0]).toMatchObject({
      userid: null,
      purpose: 'provider_test',
      totalTokens: null,
      promptTokens: null,
      completionTokens: null,
      status: 'cancelled',
      usageStatus: 'unknown',
    });
  });

  it('preserves zero and aliases, but rejects malformed token counts', () => {
    expect(
      readAiUsage(
        {
          input_tokens: 0,
          output_tokens: 0,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
        'chat'
      )
    ).toMatchObject({ totalTokens: 0, cacheHitTokens: 0, reasoningTokens: 0 });
    expect(
      readAiUsage({ prompt_tokens: true, completion_tokens: '', total_tokens: -1 }, 'chat')
    ).toMatchObject({ promptTokens: null, completionTokens: null, totalTokens: null });
    expect(readAiUsage({ prompt_tokens: 9 }, 'embedding')).toMatchObject({
      promptTokens: 9,
      completionTokens: 0,
      totalTokens: 9,
    });
    expect(readAiUsage({ completion_tokens: 3 }, 'chat')).toMatchObject({
      completionTokens: 3,
      promptTokens: null,
      totalTokens: null,
    });
  });

  it('reports a safe persistence failure without changing the provider outcome', async () => {
    const log = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const recorder = createAiUsageRecorder(provider, 'chat', undefined, async () => {
        throw new Error('secret SQL parameters');
      });
      recorder.dispatch();
      await recorder.finish('completed');
      expect(log).toHaveBeenCalledWith(
        'ai_usage_persist_failed',
        expect.objectContaining({ errorType: 'Error', requestId: expect.any(String) })
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    } finally {
      log.mockRestore();
    }
  });
});

it('uses half-open explicit ranges and rejects invalid filters', () => {
  const now = new Date('2026-10-09T00:00:00Z');
  const defaults = parseAiUsageFilters({}, now);
  expect(defaults.startAt.toISOString()).toBe('2026-09-09T00:00:00.000Z');
  expect(defaults.endAt).toBe(now);
  for (const query of [
    { type: 'invalid' },
    { startAt: 'invalid', endAt: now.toISOString() },
    { startAt: now.toISOString() },
    { startAt: now.toISOString(), endAt: '2026-10-08T00:00:00Z' },
  ]) {
    expect(() => parseAiUsageFilters(query)).toThrow('invalid_ai_usage_filter');
  }
});
