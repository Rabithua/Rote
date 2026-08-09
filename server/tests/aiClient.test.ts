import { afterEach, describe, expect, it } from 'bun:test';
import {
  AiProviderStreamError,
  createChatCompletion,
  createChatCompletionStreamParts,
  createChatCompletionWithToolsStreaming,
  probeChatProviderToolCalling,
  type ChatToolDefinition,
} from '../utils/ai/client';
import type { AiProviderConfig } from '../types/config';

const originalFetch = globalThis.fetch;

const config: AiProviderConfig = {
  providerId: 'test',
  baseUrl: 'http://test.local/v1',
  model: 'test-chat',
  apiKey: 'token',
};

const tools: ChatToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_rotes',
      description: 'search',
      parameters: {},
    },
  },
];

function sseResponse(events: unknown[], options: { includeDone?: boolean; close?: boolean } = {}) {
  const encoder = new TextEncoder();
  const includeDone = options.includeDone !== false;
  const close = options.close !== false;
  return new Response(
    new ReadableStream({
      start(controller) {
        events.forEach((event) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        );
        if (includeDone) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        if (close) controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ai client streaming', () => {
  it('appends chunked streamed tool function names', async () => {
    globalThis.fetch = (async () =>
      sseResponse([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'search_', arguments: '{"query":"' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { name: 'rotes', arguments: 'work"}' },
                  },
                ],
              },
            },
          ],
        },
      ])) as typeof fetch;

    const result = await createChatCompletionWithToolsStreaming(
      config,
      [{ role: 'user', content: 'search' }],
      tools
    );

    expect(result.message.tool_calls?.[0]).toMatchObject({
      id: 'call_1',
      function: {
        name: 'search_rotes',
        arguments: '{"query":"work"}',
      },
    });
  });

  it('uses auto tool choice for tool calling probes', async () => {
    let requestBody: any;
    globalThis.fetch = (async (_url, init) => {
      requestBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_probe',
                    type: 'function',
                    function: {
                      name: 'rote_tool_calling_probe',
                      arguments: '{"token":"rote-tool-probe"}',
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const result = await probeChatProviderToolCalling(config);

    expect(result.supported).toBe(true);
    expect(requestBody.tool_choice).toBe('auto');
  });

  it('rejects a tool stream that ends before a terminal marker', async () => {
    globalThis.fetch = (async () =>
      sseResponse(
        [
          {
            choices: [
              {
                delta: {
                  content: 'partial',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_1',
                      function: { name: 'search_rotes', arguments: '{"query":' },
                    },
                  ],
                },
              },
            ],
          },
        ],
        { includeDone: false }
      )) as typeof fetch;

    await expect(
      createChatCompletionWithToolsStreaming(config, [{ role: 'user', content: 'search' }], tools)
    ).rejects.toMatchObject<Partial<AiProviderStreamError>>({
      code: 'ai_provider_stream_incomplete',
    });
  });

  it('rejects a final answer stream that ends before a terminal marker', async () => {
    globalThis.fetch = (async () =>
      sseResponse([{ choices: [{ delta: { content: 'partial answer' } }] }], {
        includeDone: false,
      })) as typeof fetch;

    const consume = async () => {
      for await (const _part of createChatCompletionStreamParts(config, [
        { role: 'user', content: 'answer' },
      ])) {
        // Consume the stream to surface its terminal validation.
      }
    };

    await expect(consume()).rejects.toMatchObject<Partial<AiProviderStreamError>>({
      code: 'ai_provider_stream_incomplete',
    });
  });

  it('accepts a valid finish reason when the provider omits DONE', async () => {
    globalThis.fetch = (async () =>
      sseResponse([{ choices: [{ delta: { content: 'complete' }, finish_reason: 'stop' }] }], {
        includeDone: false,
      })) as typeof fetch;
    const parts = [];

    for await (const part of createChatCompletionStreamParts(config, [
      { role: 'user', content: 'answer' },
    ])) {
      parts.push(part);
    }

    expect(parts).toEqual([{ type: 'content', text: 'complete' }]);
  });

  it('keeps reading the usage chunk after a valid finish reason', async () => {
    globalThis.fetch = (async () =>
      sseResponse([
        { choices: [{ delta: { content: 'complete' }, finish_reason: 'stop' }] },
        {
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        },
      ])) as typeof fetch;
    const parts = [];

    for await (const part of createChatCompletionStreamParts(config, [
      { role: 'user', content: 'answer' },
    ])) {
      parts.push(part);
    }

    expect(parts).toContainEqual({
      type: 'usage',
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    });
  });

  it('rejects truncated output even when DONE follows', async () => {
    globalThis.fetch = (async () =>
      sseResponse([
        { choices: [{ delta: { content: 'cut off' }, finish_reason: 'length' }] },
      ])) as typeof fetch;

    const consume = async () => {
      for await (const _part of createChatCompletionStreamParts(config, [
        { role: 'user', content: 'answer' },
      ])) {
        // Consume the stream to surface its terminal validation.
      }
    };

    await expect(consume()).rejects.toMatchObject<Partial<AiProviderStreamError>>({
      code: 'ai_provider_output_truncated',
    });
  });

  it('rejects a provider stream that stays idle', async () => {
    globalThis.fetch = (async () =>
      sseResponse([], { includeDone: false, close: false })) as typeof fetch;

    await expect(
      createChatCompletionWithToolsStreaming(config, [{ role: 'user', content: 'search' }], tools, {
        idleTimeoutMs: 5,
        requestTimeoutMs: 100,
      })
    ).rejects.toMatchObject<Partial<AiProviderStreamError>>({ code: 'ai_provider_timeout' });
  });

  it('propagates an external abort signal', async () => {
    globalThis.fetch = (async (_url, init) => {
      const signal = init?.signal;
      return new Response(
        new ReadableStream({
          start(controller) {
            signal?.addEventListener(
              'abort',
              () => controller.error(signal.reason || new DOMException('Aborted', 'AbortError')),
              { once: true }
            );
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }) as typeof fetch;
    const controller = new AbortController();
    const request = createChatCompletionWithToolsStreaming(
      config,
      [{ role: 'user', content: 'search' }],
      tools,
      { signal: controller.signal }
    );
    controller.abort(new DOMException('Aborted', 'AbortError'));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('times out a non-streaming provider request', async () => {
    globalThis.fetch = ((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init.signal?.reason || new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      })) as typeof fetch;

    await expect(
      createChatCompletion(config, [{ role: 'user', content: 'answer' }], {
        requestTimeoutMs: 5,
      })
    ).rejects.toMatchObject<Partial<AiProviderStreamError>>({ code: 'ai_provider_timeout' });
  });
});
