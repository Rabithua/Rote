import { afterEach, describe, expect, it } from 'bun:test';
import type { AiConfig } from '../types/config';
import type { RoteAgentStreamEvent } from '../utils/ai/agent/types';

const originalFetch = globalThis.fetch;

const config: AiConfig = {
  enabled: true,
  vectorEnabled: true,
  autoIndexEnabled: true,
  publicExploreVectorEnabled: false,
  chat: { providerId: 'test', baseUrl: 'http://test', model: 'test-chat' },
  embedding: {
    providerId: 'test',
    baseUrl: 'http://test',
    model: 'test-embedding',
    dimensions: 3,
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
