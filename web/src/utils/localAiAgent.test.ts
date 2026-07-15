import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localAiAgentStream } from '@/utils/localAiAgent';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  bootstrap: vi.fn(),
  executeTool: vi.fn(),
  clientContext: {
    nowIso: '2026-07-07T14:14:35.000Z',
    localDate: '2026-07-07',
    localDateTime: '2026-07-07T22:14:35+08:00',
    timeZone: 'Asia/Shanghai',
    utcOffsetMinutes: 480,
    locale: 'zh-CN',
    calendar: 'gregory',
  },
}));

vi.mock('@/utils/localAi', () => ({
  streamLocalChatCompletion: mocks.complete,
}));

vi.mock('@/utils/aiApi', () => ({
  getClientAgentBootstrap: mocks.bootstrap,
  executeClientAgentTool: mocks.executeTool,
  withAiClientRequestContext: (payload: {
    clientContext?: unknown;
    state?: { clientContext?: unknown } | null;
  }) => {
    const clientContext = payload.clientContext || mocks.clientContext;
    return {
      ...payload,
      clientContext,
      state: payload.state
        ? {
            ...payload.state,
            clientContext: payload.state.clientContext || clientContext,
          }
        : payload.state,
    };
  },
  buildAiClientTimeContextMessage: () => 'Client time context for tests',
}));

const config = {
  enabled: true,
  baseUrl: 'http://127.0.0.1:11435/v1',
  model: 'gemma-local',
  apiKey: 'token',
  temperature: 0.2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('local AI agent', () => {
  it('keeps ordinary local chat independent from Rote tools', async () => {
    mocks.complete.mockImplementation(async ({ onContent }) => {
      onContent?.('private reply');
      return { message: { role: 'assistant', content: 'private reply' } };
    });
    const onDelta = vi.fn();

    await localAiAgentStream({
      config,
      payload: { message: 'hello' },
      handlers: { onDelta },
      toolsAvailable: false,
      enableThinking: false,
    });

    expect(onDelta).toHaveBeenCalledWith('private reply');
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ enableThinking: false }));
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });

  it('executes an authenticated Rote tool only when tools are available', async () => {
    mocks.bootstrap.mockResolvedValue({
      systemPrompt: 'Rote agent',
      finalAnswerInstruction: 'Answer now',
      tools: [
        {
          type: 'function',
          function: { name: 'rote_get_tags', description: 'tags', parameters: {} },
        },
      ],
      policy: { maxIterations: 2, maxToolCalls: 2, maxSources: 20, maxSourceChars: 12_000 },
    });
    mocks.complete
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'rote_get_tags', arguments: '{}' },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'final answer', tool_calls: [] },
      });
    mocks.executeTool.mockResolvedValue({
      observations: ['Loaded tags'],
      modelContent: '{"tags":[]}',
      sources: [],
      state: { stateVersion: 1, seenSourceIds: [] },
      sourceKeys: [],
      sourceCharsUsed: 250,
    });
    const onDelta = vi.fn();

    await localAiAgentStream({
      config,
      payload: { message: 'show tags' },
      handlers: { onDelta },
      toolsAvailable: true,
      enableThinking: true,
    });

    expect(mocks.complete).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ enableThinking: true })
    );
    expect(mocks.complete).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ enableThinking: true })
    );
    expect(mocks.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'rote_get_tags',
        arguments: {},
        request: expect.objectContaining({ clientContext: mocks.clientContext }),
        sourceCharsUsed: 0,
      })
    );
    expect(onDelta).toHaveBeenCalledWith('final answer');
  });

  it('adds tool messages for calls skipped after the tool budget is exhausted', async () => {
    mocks.bootstrap.mockResolvedValue({
      systemPrompt: 'Rote agent',
      finalAnswerInstruction: 'Answer now',
      tools: [
        {
          type: 'function',
          function: { name: 'rote_get_tags', description: 'tags', parameters: {} },
        },
        {
          type: 'function',
          function: { name: 'rote_search_notes', description: 'search', parameters: {} },
        },
      ],
      policy: { maxIterations: 2, maxToolCalls: 1, maxSources: 20, maxSourceChars: 12_000 },
    });
    mocks.complete
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'rote_get_tags', arguments: '{}' },
            },
            {
              id: 'call_2',
              type: 'function',
              function: { name: 'rote_search_notes', arguments: '{"query":"x"}' },
            },
          ],
        },
      })
      .mockImplementationOnce(
        async (params: {
          messages: Array<{ role: string; tool_call_id?: string; content?: string | null }>;
        }) => {
          const { messages } = params;
          const skippedToolMessage = messages.find(
            (message) => message.role === 'tool' && message.tool_call_id === 'call_2'
          );
          expect(JSON.parse(skippedToolMessage?.content || '{}')).toMatchObject({
            status: 'skipped',
            reason: 'tool_budget_exceeded',
            toolName: 'rote_search_notes',
          });
          return {
            message: { role: 'assistant', content: 'final answer', tool_calls: [] },
          };
        }
      );
    mocks.executeTool.mockResolvedValue({
      observations: ['Loaded tags'],
      modelContent: '{"tags":[]}',
      sources: [],
      state: { stateVersion: 1, seenSourceIds: [] },
      sourceKeys: [],
      sourceCharsUsed: 250,
    });

    await localAiAgentStream({
      config,
      payload: { message: 'show tags and notes' },
      handlers: {},
      toolsAvailable: true,
      enableThinking: false,
    });

    expect(mocks.executeTool).toHaveBeenCalledTimes(1);
  });
});
