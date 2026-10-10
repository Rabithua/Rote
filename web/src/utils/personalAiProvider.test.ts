import { afterEach, describe, expect, it, vi } from 'vitest';
import { testPersonalAiProvider } from '@/utils/personalAiProvider';

const remoteConfig = {
  enabled: true,
  baseUrl: 'https://api.example.com/v1',
  model: 'remote-model',
  apiKey: 'remote-token',
  temperature: 0.2,
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(`personal AI provider test`, () => {
  it.each(['glm-5.3-flash', 'gpt-5.2'])(
    'tests %s with the same effort policy as chat',
    async (model) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'OK' } }] }));
      vi.stubGlobal('fetch', fetchMock);
      await testPersonalAiProvider({ ...remoteConfig, model });
      expect(fetchMock.mock.calls).toHaveLength(2);
      for (const call of fetchMock.mock.calls) {
        const body = JSON.parse(call[1].body);
        expect(body.reasoning_effort).toBe('high');
        if (model === 'gpt-5.2') expect(body).not.toHaveProperty('temperature');
      }
    }
  );

  it(`calls the configured remote API from the browser`, async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'OK' } }], usage: { total_tokens: 1 } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'OK' } }] }))
      .mockResolvedValueOnce(
        jsonResponse({
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
