import { afterEach, describe, expect, it, vi } from 'vitest';
import { testPersonalAiProvider } from '@/utils/personalAiProvider';

const remoteConfig = {
  enabled: true,
  baseUrl: 'https://api.example.com/v1',
  model: 'remote-model',
  apiKey: 'remote-token',
  temperature: 0.2,
};

function sseResponse(body: {
  choices?: Array<{ message: Record<string, unknown> }>;
  usage?: unknown;
}) {
  const chunk = {
    choices: body.choices?.map(({ message }) => ({ delta: message, finish_reason: 'stop' })),
    usage: body.usage,
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(`personal AI provider test`, () => {
  it('keeps the localized proxy interception error when the shared client receives HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><body>Connection Closed: SGErrorDomain</body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      )
    );
    await expect(testPersonalAiProvider(remoteConfig)).rejects.toThrow(
      'personal_ai_proxy_intercepted'
    );
  });

  it('uses Kimi default thinking without incompatible sampling or K3 effort fields', async () => {
    const bodies: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body);
        if ('temperature' in body || 'reasoning_effort' in body || 'thinking' in body)
          throw new Error('Kimi K2.7 rejects these explicit overrides');
        return sseResponse({ choices: [{ message: { content: 'OK' } }] });
      })
    );
    await testPersonalAiProvider({
      ...remoteConfig,
      baseUrl: 'https://api.moonshot.cn/v1',
      model: 'kimi-k2.7-code',
    });
    expect(bodies).toHaveLength(2);
    expect(bodies[1].tool_choice).toBe('auto');
  });

  it('uses thinking streams for both DashScope connection and tool probes', async () => {
    const bodies: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body);
        if (!body.stream || !body.enable_thinking) throw new Error('invalid DashScope transport');
        return sseResponse({ choices: [{ message: { content: 'OK' } }] });
      })
    );
    await testPersonalAiProvider({
      ...remoteConfig,
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.5-27b',
    });
    expect(bodies).toHaveLength(2);
    expect(bodies[1].tool_choice).toBe('auto');
  });

  it('rejects a connection probe whose stream ends early, like normal chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    );
    await expect(testPersonalAiProvider(remoteConfig)).rejects.toMatchObject({
      code: 'ai_provider_stream_incomplete',
    });
  });
  it.each([
    ['glm-5.3-flash', 'https://open.bigmodel.cn/api/coding/paas/v4'],
    ['gpt-5.2', 'https://api.openai.com/v1'],
  ])('tests %s with the same effort policy as chat', async (model, baseUrl) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse({ choices: [{ message: { content: 'OK' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await testPersonalAiProvider({ ...remoteConfig, model, baseUrl });
    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(call[1].body);
      expect(body.reasoning_effort).toBe('high');
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
      if (model === 'gpt-5.2') expect(body).not.toHaveProperty('temperature');
    }
  });

  it(`calls the configured remote API from the browser`, async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse({ choices: [{ message: { content: 'OK' } }], usage: { total_tokens: 1 } })
      )
      .mockResolvedValueOnce(
        sseResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: 'rote_tool_calling_probe',
                      arguments: `{"token":"rote-tool-probe"}`,
                    },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await testPersonalAiProvider(remoteConfig);

    expect(result.data.success).toBe(true);
    expect(result.data.toolCalling?.supported).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual(
      expect.objectContaining({
        tool_choice: 'auto',
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer remote-token`,
        },
      })
    );
  });

  it(`maps remote browser fetch failures to a cors error code`, async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(`Failed to fetch`)));

    await expect(testPersonalAiProvider(remoteConfig)).rejects.toThrow(`personal_ai_cors_blocked`);
  });

  it(`uses local fallback candidates for browser provider tests`, async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError(`Failed to fetch`))
      .mockResolvedValueOnce(sseResponse({ choices: [{ message: { content: 'OK' } }] }))
      .mockResolvedValueOnce(
        sseResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: 'rote_tool_calling_probe',
                      arguments: `{"token":"rote-tool-probe"}`,
                    },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await testPersonalAiProvider({
      ...remoteConfig,
      baseUrl: 'http://127.0.0.1:11435/v1',
      apiKey: '',
    });

    expect(result.data.success).toBe(true);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://127.0.0.1:11435/v1/chat/completions',
      'http://localhost:11435/v1/chat/completions',
      'http://127.0.0.1:11435/v1/chat/completions',
    ]);
  });
});
