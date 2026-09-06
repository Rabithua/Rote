import { describe, expect, it } from 'bun:test';
import {
  canonicalizeSearchRotesArgs,
  canonicalizeTimeRange,
  createRetrievalPlan,
  lifecycleScopeToArchived,
  toPlannerAgentDto,
  type RetrievalScope,
  type SearchRotesProbeExecutor,
} from '../utils/ai/retrievalPlan';
import type { AiConfig } from '../types/config';
import type { ChatMessage, ChatToolCall, ChatToolDefinition } from '../utils/ai/client';

const AVAILABLE_TAGS = ['工作', '生活', '开心'];

const config: AiConfig = {
  schemaVersion: 2,
  revision: 0,
  enabled: true,
  vectorEnabled: true,
  autoIndexEnabled: true,
  publicExploreVectorEnabled: false,
  chat: { providerId: 'test', baseUrl: 'http://test', model: 'test-chat' },
  embedding: {
    providerId: 'test',
    baseUrl: 'http://test',
    model: 'test-embedding',
    output: { mode: 'dimensions', dimensions: 3 },
  },
  indexing: { chunkSize: 800, chunkOverlap: 100, batchSize: 10, maxRetries: 1 },
};

function toolCall(name: string, args: unknown, id = `call_${name}`): ChatToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

function completionSequence(calls: ChatToolCall[][]) {
  let index = 0;
  return async (
    _config: any,
    _messages: ChatMessage[],
    _tools: ChatToolDefinition[]
  ): Promise<{ message: ChatMessage; usage: undefined }> => ({
    message: {
      role: 'assistant',
      content: null,
      tool_calls: calls[index++] || [],
    },
    usage: undefined,
  });
}

function probe(): SearchRotesProbeExecutor {
  return async (scope: RetrievalScope) => ({
    sources: [
      {
        sourceType: 'rote',
        sourceId: 'r1',
        text: 'A matching note',
        similarity: 0.9,
        metadata: { tags: scope.tags },
      },
    ],
    toolResult: {
      canonicalizedArgs: scope,
      resultCount: 1,
      topSnippets: [
        {
          id: 'rote:r1',
          sourceType: 'rote',
          sourceId: 'r1',
          similarity: 0.9,
          text: 'A matching note',
          tags: scope.tags,
        },
      ],
      cursor: null,
      warnings: [],
    },
  });
}

describe('canonicalizeSearchRotesArgs', () => {
  it('downgrades unknown tags into semanticScope', () => {
    const { scope, warnings } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { tags: ['工作', '不存在'], excludeTags: ['生活', '未知'] },
    });

    expect(scope.tags).toEqual(['工作']);
    expect(scope.excludeTags).toEqual(['生活']);
    expect(scope.semanticScope).toContain('不存在');
    expect(scope.semanticScope).toContain('未知');
    expect(warnings).toContain('unknown_tag_downgraded:不存在');
    expect(warnings).toContain('unknown_exclude_tag_downgraded:未知');
  });

  it('keeps lifecycleScope and taskStatusScope independent', () => {
    const { scope } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { lifecycleScope: 'archived', taskStatusScope: 'open' },
    });

    expect(scope.lifecycleScope).toBe('archived');
    expect(scope.taskStatusScope).toBe('open');
    expect(lifecycleScopeToArchived(scope.lifecycleScope)).toBe(true);
  });

  it('defaults an unbounded recent request to the latest 30 created records', () => {
    const { scope } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      message: '最近我的记录里有哪些反复出现的主题？',
      args: { query: '反复出现的主题' },
    });

    expect(scope.selection).toBe('recent');
    expect(scope.dateField).toBe('createdAt');
    expect(scope.limit).toBe(30);
    expect(scope.timeRange).toBeNull();
  });

  it('keeps explicit relevance searches and supports updated records', () => {
    const { scope } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      message: '最近修改过的 iOS 笔记',
      args: {
        query: 'iOS',
        selection: 'relevance',
        dateField: 'updatedAt',
        timeExpression: '最近30天',
      },
    });

    expect(scope.selection).toBe('relevance');
    expect(scope.dateField).toBe('updatedAt');
    expect(scope.timeRange?.label).toBe('最近30天');
  });

  it('overrides unbounded relevance when the user clearly asks for recent records', () => {
    const explicitRelevance = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      message: '最近我的记录',
      args: { query: '工作', selection: 'relevance' },
    });
    const invalidRecentExpression = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      message: '最近我的记录',
      args: { query: '工作', selection: 'relevance', timeExpression: '最近' },
    });

    expect(explicitRelevance.scope.selection).toBe('recent');
    expect(explicitRelevance.scope.limit).toBe(30);
    expect(invalidRecentExpression.scope.selection).toBe('recent');
    expect(invalidRecentExpression.scope.timeRange).toBeNull();
  });

  it('uses the recent corpus for broad analysis inside an explicit window', () => {
    const { scope } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      message: '最近30天有哪些反复出现的主题？',
      args: { timeExpression: '最近30天' },
    });

    expect(scope.selection).toBe('recent');
    expect(scope.timeRange?.label).toBe('最近30天');
    expect(scope.limit).toBe(30);
  });

  it('canonicalizes time ranges', () => {
    expect(canonicalizeTimeRange({ from: '2026-01-01', to: '2026-01-03' })).toMatchObject({
      from: '2026-01-01T00:00:00+08:00',
      to: '2026-01-03T23:59:59+08:00',
    });
    expect(
      canonicalizeTimeRange({
        from: '2026-01-01T08:00:00+08:00',
        to: '2026-01-03T18:30:00+08:00',
      })
    ).toMatchObject({
      from: '2026-01-01T08:00:00+08:00',
      to: '2026-01-03T18:30:00+08:00',
    });
    expect(canonicalizeTimeRange({ timeExpression: '今天' })?.label).toBe('今天');
    expect(canonicalizeTimeRange({ timeExpression: '最近7天' })?.label).toBe('最近7天');
  });

  it('normalizes structured relative from/to ranges before SQL use', () => {
    const range = canonicalizeTimeRange({ from: '60 days ago', to: '30 days ago' });

    expect(range?.from).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/);
    expect(range?.to).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\+08:00$/);
    expect(range?.from).not.toContain('days ago');
    expect(range?.to).not.toContain('days ago');
    expect(Date.parse(range?.from || '')).toBeLessThan(Date.parse(range?.to || ''));
  });

  it('anchors relative dates to the client request date', () => {
    const range = canonicalizeTimeRange({ timeExpression: '上月' }, undefined, {
      nowIso: '2026-07-07T14:14:35.000Z',
      localDate: '2026-07-07',
      localDateTime: '2026-07-07T22:14:35+08:00',
      timeZone: 'Asia/Shanghai',
      utcOffsetMinutes: 480,
    });

    expect(range).toMatchObject({
      from: '2026-06-01T00:00:00+08:00',
      to: '2026-06-30T23:59:59+08:00',
      label: '上个月',
    });
  });

  it('prefers structured timeRange DSL over free-text fields', () => {
    expect(
      canonicalizeTimeRange({
        timeRange: { type: 'absolute', fromDate: '2026-05-08', toDate: '2026-05-09' },
        from: 'bad input',
        to: 'also bad',
      })
    ).toMatchObject({
      from: '2026-05-08T00:00:00+08:00',
      to: '2026-05-09T23:59:59+08:00',
    });

    const rolling = canonicalizeTimeRange({
      timeRange: { type: 'rolling', amount: 7, unit: 'day' },
    });
    expect(rolling?.from).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/);
    expect(rolling?.to).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\+08:00$/);
    expect(rolling?.label).toBe('last 7 days');

    const relativeBetween = canonicalizeTimeRange({
      timeRange: {
        type: 'relative_between',
        fromRelative: { amount: 60, unit: 'day', direction: 'ago' },
        toRelative: { amount: 30, unit: 'day', direction: 'ago' },
      },
    });
    expect(relativeBetween?.from).toMatch(/T00:00:00\+08:00$/);
    expect(relativeBetween?.to).toMatch(/T23:59:59\+08:00$/);
    expect(Date.parse(relativeBetween?.from || '')).toBeLessThan(
      Date.parse(relativeBetween?.to || '')
    );

    expect(canonicalizeTimeRange({ timeRange: { type: 'preset', preset: 'today' } })?.label).toBe(
      '今天'
    );
  });

  it('honors structured timeRange type when extra fields are present', () => {
    expect(
      canonicalizeTimeRange({
        timeRange: {
          type: 'absolute',
          fromDate: '2026-05-08',
          toDate: '2026-05-09',
          unit: 'day',
        },
      })
    ).toMatchObject({
      from: '2026-05-08T00:00:00+08:00',
      to: '2026-05-09T23:59:59+08:00',
    });

    expect(
      canonicalizeTimeRange({
        timeRange: {
          type: 'absolute',
          preset: 'today',
          fromDate: '2026-05-08',
          toDate: '2026-05-09',
        },
      })?.label
    ).toBe('2026-05-08 到 2026-05-09');
  });

  it('ignores invalid time ranges instead of passing them through', () => {
    const warnings: string[] = [];

    expect(canonicalizeTimeRange({ from: 'sixty days ago', to: '30 days ago' }, warnings)).toBe(
      null
    );
    expect(warnings).toContain('invalid_time_range_ignored');

    const scoped = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { from: '2026-02-30', to: '2026-03-01' },
    });
    expect(scoped.scope.timeRange).toBeNull();
    expect(scoped.warnings).toContain('invalid_time_range_ignored');

    const dslScoped = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { timeRange: { type: 'rolling', amount: 0, unit: 'day' } },
    });
    expect(dslScoped.scope.timeRange).toBeNull();
    expect(dslScoped.warnings).toContain('invalid_time_range_ignored');
  });

  it('clamps limit and validates sourceTypes', () => {
    const { scope, warnings } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { limit: 999, sourceTypes: ['rote', 'bad' as any] },
    });

    expect(scope.limit).toBe(50);
    expect(scope.sourceTypes).toEqual(['rote']);
    expect(warnings).toContain('invalid_source_type:bad');
  });

  it('carries excludeIds into canonical scope', () => {
    const { scope } = canonicalizeSearchRotesArgs({
      ownerId: 'u1',
      availableTags: AVAILABLE_TAGS,
      args: { query: '继续查' },
      excludeIds: ['rote:r1'],
    });

    expect(scope.excludeIds).toEqual(['rote:r1']);
  });
});

describe('createRetrievalPlan tool loop', () => {
  it('finishes without retrieval', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '谢谢',
      config,
      availableTags: AVAILABLE_TAGS,
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('finish', { retrievalNeeded: false, reason: 'chat_only' })],
      ]),
    });

    expect(result.retrievalNeeded).toBe(false);
    expect(result.debugTrace.finishReason).toBe('chat_only');
  });

  it('runs a single search then finishes', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '找工作笔记',
      config,
      availableTags: AVAILABLE_TAGS,
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('search_rotes', { query: '工作', tags: ['工作'] })],
        [toolCall('finish', { useLastSearch: true, reason: 'enough' })],
      ]),
    });

    expect(result.retrievalNeeded).toBe(true);
    expect(result.scope?.query).toBe('工作');
    expect(result.scope?.tags).toEqual(['工作']);
    expect(result.toolResult?.resultCount).toBe(1);
  });

  it('does not include raw sources in the public DTO', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '找工作笔记',
      config,
      availableTags: AVAILABLE_TAGS,
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('search_rotes', { query: '工作', tags: ['工作'] })],
        [toolCall('finish', { useLastSearch: true, reason: 'enough' })],
      ]),
    });
    const dto = toPlannerAgentDto(result);

    expect('sources' in dto).toBe(false);
    expect(dto.toolResult?.topSnippets[0]?.text).toBe('A matching note');
  });

  it('surfaces probe failures instead of converting them to no-retrieval', async () => {
    await expect(
      createRetrievalPlan({
        ownerId: 'u1',
        message: '找工作笔记',
        config,
        availableTags: AVAILABLE_TAGS,
        executeSearch: async () => {
          throw new Error('vector unavailable');
        },
        completeWithTools: completionSequence([
          [toolCall('search_rotes', { query: '工作', tags: ['工作'] })],
        ]),
      })
    ).rejects.toThrow('vector unavailable');
  });

  it('can list tags before searching', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '按准确标签查',
      config,
      availableTags: AVAILABLE_TAGS,
      getTagCounts: async () => [{ name: '工作', count: 3 }],
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('list_tags', { limit: 5 })],
        [toolCall('search_rotes', { query: '', tags: ['工作'] })],
        [toolCall('finish', { useLastSearch: true, reason: 'tag_checked' })],
      ]),
    });

    expect(result.debugTrace.toolCalls.map((call) => call.name)).toEqual([
      'list_tags',
      'search_rotes',
      'finish',
    ]);
    expect(result.scope?.tags).toEqual(['工作']);
  });

  it('uses the last search after multiple searches', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '多查几次',
      config,
      availableTags: AVAILABLE_TAGS,
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('search_rotes', { query: 'first', tags: ['工作'] })],
        [toolCall('search_rotes', { query: 'second', tags: ['生活'] })],
        [toolCall('finish', { useLastSearch: true, reason: 'use_latest' })],
      ]),
    });

    expect(result.scope?.query).toBe('second');
    expect(result.scope?.tags).toEqual(['生活']);
    expect(result.debugTrace.canonicalizedArgs).toHaveLength(2);
  });

  it('requests clarification', async () => {
    const result = await createRetrievalPlan({
      ownerId: 'u1',
      message: '那件事',
      config,
      availableTags: AVAILABLE_TAGS,
      executeSearch: probe(),
      completeWithTools: completionSequence([
        [toolCall('request_clarification', { question: '你想查哪件事？', reason: 'ambiguous' })],
      ]),
    });

    expect(result.retrievalNeeded).toBe(false);
    expect(result.clarification?.question).toBe('你想查哪件事？');
  });
});
