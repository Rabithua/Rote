import { afterEach, describe, expect, it } from 'bun:test';
import type { AiConfig } from '../types/config';
import type { RoteAgentStreamEvent } from '../utils/ai/agent/types';

const originalFetch = globalThis.fetch;

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
    output: { mode: 'dimensions', output: { mode: 'dimensions', dimensions: 3 } },
  },
  indexing: { chunkSize: 800, chunkOverlap: 100, batchSize: 10, maxRetries: 1 },
};

function sseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        events.forEach((event) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('agent tool decision output', () => {
  it('does not emit tool-decision draft content before the final answer', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return sseResponse([
          {
            choices: [
              {
                delta: {
                  content: 'Let me inspect that first.',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_skill',
                      function: { name: 'rote_skill_view', arguments: '{}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
        ]);
      }
      if (requestCount === 2) {
        return sseResponse([
          {
            choices: [{ delta: { content: 'I can answer now.' }, finish_reason: 'stop' }],
          },
        ]);
      }
      return sseResponse([
        { choices: [{ delta: { content: 'Final ' } }] },
        { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] },
      ]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];

    await runRoteAgentStream({
      userId: '00000000-0000-4000-8000-000000000001',
      request: { message: 'Analyze my notes', enableThinking: true },
      config,
      emit: (event) => {
        events.push(event);
      },
    });

    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', text: 'Final ' },
      { type: 'delta', text: 'answer' },
    ]);
    expect(requestCount).toBe(3);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });

  it('streams the final answer after a no-tool decision instead of flushing decision content', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return sseResponse([
          {
            choices: [{ delta: { content: 'Cached direct answer' }, finish_reason: 'stop' }],
          },
        ]);
      }
      return sseResponse([
        { choices: [{ delta: { content: 'Direct ' } }] },
        { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] },
      ]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];

    await runRoteAgentStream({
      userId: '00000000-0000-4000-8000-000000000001',
      request: { message: 'Say hello', enableThinking: true },
      config,
      emit: (event) => {
        events.push(event);
      },
    });

    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', text: 'Direct ' },
      { type: 'delta', text: 'answer' },
    ]);
    expect(
      events.some((event) => event.type === 'delta' && event.text === 'Cached direct answer')
    ).toBe(false);
    expect(requestCount).toBe(2);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
  });

  it('uses error as the only terminal event when no answer is produced', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    globalThis.fetch = (async () =>
      sseResponse([{ choices: [{ delta: {}, finish_reason: 'stop' }] }])) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];

    await runRoteAgentStream({
      userId: '00000000-0000-4000-8000-000000000001',
      request: { message: 'Analyze my notes' },
      config,
      emit: (event) => {
        events.push(event);
      },
    });

    expect(events.filter((event) => event.type === 'error')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(0);
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'error_no_answer_no_sources',
      retryable: true,
    });
  });
});

describe('multi-pass evidence delivery', () => {
  it('puts both batches in the actual later provider request and emits 40 cumulative references', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const { deliverSearchEvidence } = await import('../utils/ai/agent/evidenceDelivery');
    let calls = 0;
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    globalThis.fetch = (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      const step = requests.length;
      if (step <= 2)
        return sseResponse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: `search-${step}`,
                      function: { name: 'rote_search_notes', arguments: '{}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
        ]);
      return sseResponse([
        {
          choices: [
            {
              delta: { content: step === 3 ? 'ready' : 'answer [1][21][40]' },
              finish_reason: 'stop',
            },
          ],
        },
      ]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'review' },
      config,
      emit: (event) => {
        events.push(event);
      },
      tools: [
        {
          definition: {
            type: 'function',
            function: {
              name: 'rote_search_notes',
              description: 'search',
              parameters: { type: 'object' },
            },
          },
          execute: async (_args, ctx) => {
            const start = calls++ * 20;
            const found = Array.from({ length: 20 }, (_, i) => ({
              sourceType: 'rote' as const,
              sourceId: `note-${start + i + 1}`,
              text: `evidence-${start + i + 1}`,
              similarity: 1,
              metadata: {},
            }));
            const result = deliverSearchEvidence(ctx, found);
            return {
              ...result,
              observations: [],
              statePatch: { seenSourceIds: ctx.sourceBudget.keys() },
            };
          },
        },
      ],
    });
    const sources = events.filter((event) => event.type === 'sources');
    expect(sources.map((event) => event.sources.length)).toEqual([20, 40]);
    expect(sources[1].retrieval).toMatchObject({ addedCount: 20, totalCount: 40 });
    const evidenceMessages = requests
      .at(-1)!
      .messages.filter((m) => m.role === 'tool')
      .map((m) => JSON.parse(m.content));
    expect(evidenceMessages[0].sources[0]).toMatchObject({ citation: 1, excerpt: 'evidence-1' });
    expect(evidenceMessages[1].sources[0]).toMatchObject({ citation: 21, excerpt: 'evidence-21' });
    expect(evidenceMessages[1].sources.at(-1)).toMatchObject({
      citation: 40,
      excerpt: 'evidence-40',
    });
  });

  it('stops tools after exhaustion and supplies a result for every pending tool call', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const { deliverSearchEvidence } = await import('../utils/ai/agent/evidenceDelivery');
    let toolExecutions = 0;
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    globalThis.fetch = (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1)
        return sseResponse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [0, 1, 2].map((index) => ({
                    index,
                    id: `call-${index}`,
                    function: { name: 'rote_search_notes', arguments: '{}' },
                  })),
                },
                finish_reason: 'tool_calls',
              },
            ],
          },
        ]);
      return sseResponse([
        { choices: [{ delta: { content: 'limited answer' }, finish_reason: 'stop' }] },
      ]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'review' },
      config,
      policy: { maxSourceChars: 300 },
      emit: (event) => {
        events.push(event);
      },
      tools: [
        {
          definition: {
            type: 'function',
            function: {
              name: 'rote_search_notes',
              description: 'search',
              parameters: { type: 'object' },
            },
          },
          execute: async (_args, ctx) => {
            toolExecutions++;
            return {
              ...deliverSearchEvidence(ctx, [
                {
                  sourceType: 'rote',
                  sourceId: 'id',
                  text: 'a'.repeat(3000),
                  metadata: { title: 't'.repeat(80) },
                  similarity: 1,
                },
              ]),
              observations: [],
            };
          },
        },
      ],
    });
    expect(toolExecutions).toBe(1);
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.filter((m) => m.role === 'tool')).toHaveLength(3);
    expect(
      events.some((event) => event.type === 'sources' && event.retrieval?.budgetExhausted)
    ).toBe(true);
  });
});
