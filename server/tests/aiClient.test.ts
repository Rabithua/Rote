import { afterEach, describe, expect, it } from 'bun:test';
import {
  AiProviderStreamError,
  createChatCompletion,
  createChatCompletionStreamParts,
  createChatCompletionWithToolsStreaming,
  createChatCompletionWithTools,
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
  it('keeps Kimi fixed sampling valid in connection and tool probes', async () => {
    const kimiConfig = {
      ...config,
      baseUrl: 'https://api.moonshot.cn/v1',
      model: 'kimi-k3',
    };
    const bodies: any[] = [];
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      bodies.push(body);
      if ('temperature' in body || 'thinking' in body)
        throw new Error('Kimi K3 rejects custom sampling and K2 thinking fields');
      return Response.json({ choices: [{ message: { content: 'OK' } }] });
    }) as typeof fetch;
    await createChatCompletion(kimiConfig, []);
    await probeChatProviderToolCalling(kimiConfig);
    expect(bodies).toHaveLength(2);
    expect(bodies.every((body) => body.reasoning_effort === 'high')).toBe(true);
    expect(bodies[1].tool_choice).toBe('auto');
  });

  it('collects DashScope thinking streams for synchronous chat and tool callers', async () => {
    const thinkingConfig = { ...config, providerId: 'dashscope', model: 'qwen3.5-27b' };
    const bodies: any[] = [];
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      bodies.push(body);
      if (!body.stream || !body.enable_thinking) throw new Error('invalid DashScope transport');
      return sseResponse([
        { choices: [{ delta: { reasoning_content: 'Thought' } }] },
        {
          choices: [
            {
              delta: body.tools
                ? {
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call_1',
                        function: { name: 'search_rotes', arguments: '{}' },
                      },
                    ],
                  }
                : { content: 'OK' },
              finish_reason: body.tools ? 'tool_calls' : 'stop',
            },
          ],
        },
        { choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } },
      ]);
    }) as typeof fetch;
    expect(await createChatCompletion(thinkingConfig, [])).toEqual({
      content: 'OK',
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    });
    expect((await createChatCompletionWithTools(thinkingConfig, [], tools)).message).toMatchObject({
      reasoning_content: 'Thought',
      tool_calls: [{ id: 'call_1' }],
    });
    expect(bodies).toHaveLength(2);
  });

  it('passes complete OpenRouter reasoning blocks back in the next tool round', async () => {
    const routerConfig = {
      ...config,
      providerId: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
    };
    const bodies: any[] = [];
    globalThis.fetch = (async (_url, init) => {
      bodies.push(JSON.parse(init?.body as string));
      return sseResponse([
        {
          choices: [
            {
              delta: {
                reasoning_details: [
                  {
                    type: 'reasoning.text',
                    index: 0,
                    id: 'r0',
                    format: 'anthropic-claude-v1',
                    text: 'First ',
                    signature: 'sig-',
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
                reasoning_details: [
                  { type: 'reasoning.text', index: 0, text: 'thought', signature: 'end' },
                  { type: 'reasoning.encrypted', index: 1, id: 'r1', data: 'cipher' },
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
                  { index: 0, id: 'call_1', function: { name: 'search_rotes', arguments: '{}' } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
      ]);
    }) as typeof fetch;
    const onReasoning: string[] = [];
    const result = await createChatCompletionWithToolsStreaming(routerConfig, [], tools, {
      onReasoning: (text) => {
        onReasoning.push(text);
      },
    });
    await createChatCompletionWithToolsStreaming(
      routerConfig,
      [result.message, { role: 'tool', tool_call_id: 'call_1', content: 'found' }],
      tools
    );
    expect(onReasoning).toEqual(['First ', 'thought']);
    expect(bodies[1].messages[0].reasoning_details).toEqual([
      {
        type: 'reasoning.text',
        index: 0,
        id: 'r0',
        format: 'anthropic-claude-v1',
        text: 'First thought',
        signature: 'sig-end',
      },
      { type: 'reasoning.encrypted', index: 1, id: 'r1', data: 'cipher' },
    ]);
    expect(bodies[0].reasoning).toEqual({ effort: 'high' });
    expect(bodies[0]).not.toHaveProperty('temperature');
    expect(bodies[0]).not.toHaveProperty('thinking');
  });
  it.each(['reasoning_content', 'reasoning'] as const)(
    'keeps complete streamed %s for the next tool round, including empty reasoning',
    async (field) => {
      globalThis.fetch = (async () =>
        sseResponse([
          { choices: [{ delta: { [field]: '' } }] },
          { choices: [{ delta: { [field]: 'First ' } }] },
          { choices: [{ delta: { [field]: 'thought.' } }] },
        ])) as typeof fetch;
      const chunks: string[] = [];
      const response = await createChatCompletionWithToolsStreaming(config, [], tools, {
        onReasoning: (text) => {
          chunks.push(text);
        },
      });
      expect(response.message[field]).toBe('First thought.');
      expect(chunks).toEqual(['First ', 'thought.']);
      globalThis.fetch = (async () =>
        sseResponse([{ choices: [{ delta: { [field]: '' } }] }])) as typeof fetch;
      expect((await createChatCompletionWithToolsStreaming(config, [], tools)).message[field]).toBe(
        ''
      );
    }
  );

  it('retains reasoning fields in non-streamed tool responses', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: 'Process text', reasoning_content: 'Thought', reasoning: '' } },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;
    expect((await createChatCompletionWithTools(config, [], tools)).message).toMatchObject({
      content: 'Process text',
      reasoning_content: 'Thought',
      reasoning: '',
    });
  });

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
