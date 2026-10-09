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

describe('agent streamed output', () => {
  it('streams process text and reuses the following answer without a third request', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:1/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      if (requestCount === 1)
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
      return sseResponse([
        { choices: [{ delta: { content: 'Final ' } }] },
        { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] },
      ]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'Analyze my notes', streamOutputs: true },
      config,
      emit: (event) => {
        events.push(event);
      },
    });
    expect(requestCount).toBe(2);
    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', outputId: 'step-0', phase: 'planning', text: 'Let me inspect that first.' },
      { type: 'delta', outputId: 'step-1', phase: 'tool_calling', text: '\n\nFinal ' },
      { type: 'delta', outputId: 'step-1', phase: 'tool_calling', text: 'answer' },
    ]);
    expect(events.filter((event) => event.type === 'output_finished')).toEqual([
      { type: 'output_finished', outputId: 'step-0', phase: 'planning', kind: 'process' },
      { type: 'output_finished', outputId: 'step-1', phase: 'tool_calling', kind: 'answer' },
    ]);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
    expect(events.some((event) => event.type === 'error')).toBe(false);
  });

  it('delivers direct answer chunks before the provider completes and calls it only once', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:1/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    let releaseProvider!: () => void;
    const firstChunkDelivered = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const encoder = new TextEncoder();
    let providerCompleted = false;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(
        new ReadableStream({
          async start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: 'Direct ' } }] })}\n\n`
              )
            );
            await firstChunkDelivered;
            providerCompleted = true;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`
              )
            );
            controller.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'Say hello', streamOutputs: true },
      config,
      emit: (event) => {
        events.push(event);
        if (event.type === 'delta' && event.text === 'Direct ') {
          expect(providerCompleted).toBe(false);
          releaseProvider();
        }
      },
    });
    expect(requestCount).toBe(1);
    expect(events.filter((event) => event.type === 'delta').map((event) => event.text)).toEqual([
      'Direct ',
      'answer',
    ]);
    expect(events.filter((event) => event.type === 'output_finished')).toEqual([
      { type: 'output_finished', outputId: 'step-0', phase: 'planning', kind: 'answer' },
    ]);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
  });

  it('keeps old clients on answer-only events and still reuses the answer', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return sseResponse(
        requestCount === 1
          ? [
              {
                choices: [
                  {
                    delta: {
                      content: 'I will search.',
                      tool_calls: [
                        {
                          index: 0,
                          id: 'skill',
                          function: { name: 'rote_skill_view', arguments: '{}' },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
              },
            ]
          : [
              { choices: [{ delta: { content: 'Final ' } }] },
              { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] },
            ]
      );
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'Review my notes' },
      config,
      emit: (event) => {
        events.push(event);
      },
    });
    expect(requestCount).toBe(2);
    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', text: 'Final ' },
      { type: 'delta', text: 'answer' },
    ]);
    expect(events.some((event) => event.type === 'output_finished')).toBe(false);
  });

  it('preserves partial streamed text but never retries or completes an interrupted output', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response('data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await expect(
      runRoteAgentStream({
        userId: 'owner',
        request: { message: 'Say hello', streamOutputs: true },
        config,
        emit: (event) => {
          events.push(event);
        },
      })
    ).rejects.toMatchObject({ code: 'ai_provider_stream_incomplete' });
    expect(requestCount).toBe(1);
    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', outputId: 'step-0', phase: 'planning', text: 'Partial answer' },
    ]);
    expect(events.some((event) => event.type === 'output_finished' || event.type === 'done')).toBe(
      false
    );
  });

  it('reports an empty no-tool answer without a second generation', async () => {
    process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:1/test';
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return sseResponse([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]);
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'Analyze my notes', streamOutputs: true },
      config,
      emit: (event) => {
        events.push(event);
      },
    });
    expect(requestCount).toBe(1);
    expect(events.filter((event) => event.type === 'error')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'done')).toHaveLength(0);
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'error_no_answer_no_sources',
      retryable: true,
    });
  });
});

describe('multi-pass evidence delivery', () => {
  it('tells the final provider about exhaustion after a successful single delivery', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const { deliverSearchEvidence } = await import('../utils/ai/agent/evidenceDelivery');
    const requests: any[] = [];
    globalThis.fetch = (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return sseResponse([
        {
          choices: [
            {
              delta:
                requests.length === 1
                  ? {
                      tool_calls: [
                        {
                          index: 0,
                          id: 'search',
                          function: { name: 'rote_search_notes', arguments: '{}' },
                        },
                      ],
                    }
                  : { content: 'limited answer' },
              finish_reason: requests.length === 1 ? 'tool_calls' : 'stop',
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
      policy: { maxSourceChars: 200 },
      emit: (event) => {
        events.push(event);
      },
      tools: [
        {
          definition: {
            type: 'function',
            function: { name: 'rote_search_notes', description: 'search', parameters: {} },
          },
          execute: async (_args, ctx) => ({
            ...deliverSearchEvidence(ctx, [
              {
                id: 'fixture',
                ownerId: 'owner',
                sourceType: 'rote',
                chunkIndex: 0,
                sourceId: '00000000-0000-4000-8000-000000000001',
                text: 'short note',
                similarity: 1,
                metadata: {},
              },
            ]),
            observations: [],
          }),
        },
      ],
    });
    expect(requests).toHaveLength(2);
    expect(
      JSON.parse(requests[1].messages.find((m: any) => m.role === 'tool').content).status
    ).toBe('ok');
    expect(requests[1].messages.at(-1).content).toContain(
      'The evidence text budget has been exhausted.'
    );
    expect(events.some((e) => e.type === 'sources' && e.retrieval?.budgetExhausted)).toBe(true);
  });

  it('continues sequential reads beyond 6000 characters with the default iteration policy', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const { deliverSearchEvidence, deliverReadEvidence } =
      await import('../utils/ai/agent/evidenceDelivery');
    const requests: any[] = [];
    const offsets: number[] = [];
    const note = {
      id: 'fixture',
      ownerId: 'owner',
      sourceType: 'rote' as const,
      chunkIndex: 0,
      sourceId: '00000000-0000-4000-8000-000000000001',
      text: 'short note',
      similarity: 1,
      metadata: {},
    };
    const body = 'x'.repeat(7000) + 'IMPORTANT LATE EVIDENCE' + 'x'.repeat(1200);
    globalThis.fetch = (async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      const step = requests.length;
      return sseResponse([
        {
          choices: [
            {
              delta:
                step <= 5
                  ? {
                      tool_calls: [
                        {
                          index: 0,
                          id: `call-${step}`,
                          function: {
                            name: step === 1 ? 'rote_search_notes' : 'rote_get_note',
                            arguments: '{}',
                          },
                        },
                      ],
                    }
                  : { content: 'answer' },
              finish_reason: step <= 5 ? 'tool_calls' : 'stop',
            },
          ],
        },
      ]);
    }) as typeof fetch;
    await runRoteAgentStream({
      userId: 'owner',
      request: { message: 'read the note' },
      config,
      emit: () => {},
      tools: ['rote_search_notes', 'rote_get_note'].map((name) => ({
        definition: { type: 'function', function: { name, description: name, parameters: {} } },
        execute: async (_args, ctx) => {
          const result =
            name === 'rote_search_notes'
              ? deliverSearchEvidence(ctx, [note])
              : deliverReadEvidence(ctx, note, body);
          const next = JSON.parse(result.modelContent).nextOffset;
          if (next !== undefined) offsets.push(next);
          expect(ctx.sourceBudget.snapshot().sourceCharsUsed).toBeLessThanOrEqual(12000);
          return { ...result, observations: [] };
        },
      })),
    });
    expect(offsets).toEqual([2000, 4000, 6000, 8000]);
    expect(
      requests
        .at(-1)
        .messages.some(
          (m: any) => m.role === 'tool' && m.content.includes('IMPORTANT LATE EVIDENCE')
        )
    ).toBe(true);
  });

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
