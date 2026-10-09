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
  vi.resetAllMocks();
});

describe('local AI agent', () => {
  it('streams a direct agent answer once while the provider is still running', async () => {
    mocks.bootstrap.mockResolvedValue({
      systemPrompt: 'Rote',
      finalAnswerInstruction: 'Answer',
      tools: [],
      policy: { maxIterations: 6, maxToolCalls: 8, maxSourceChars: 12000 },
    });
    const onOutputDelta = vi.fn();
    const onOutputFinished = vi.fn();
    const onOutputStarted = vi.fn();
    const onThinking = vi.fn();
    mocks.complete.mockImplementationOnce(async ({ onContent, onReasoning }) => {
      expect(onOutputStarted).toHaveBeenCalledExactlyOnceWith({
        outputId: 'step-0',
        phase: 'planning',
      });
      onReasoning('Thinking');
      onContent('First ');
      expect(onOutputDelta).toHaveBeenCalledExactlyOnceWith({
        outputId: 'step-0',
        phase: 'planning',
        text: 'First ',
      });
      expect(onOutputFinished).not.toHaveBeenCalled();
      onContent('answer');
      return { message: { role: 'assistant', content: 'First answer' } };
    });
    await localAiAgentStream({
      config,
      payload: { message: 'hello' },
      handlers: { onOutputDelta, onOutputFinished, onOutputStarted, onThinking },
      toolsAvailable: true,
      enableThinking: false,
    });
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(onOutputDelta).toHaveBeenCalledTimes(2);
    expect(onThinking).toHaveBeenCalledExactlyOnceWith('route_decision', 'Thinking', 'step-0');
    expect(onOutputFinished).toHaveBeenCalledExactlyOnceWith({
      outputId: 'step-0',
      phase: 'planning',
      kind: 'answer',
    });
  });

  it('does not retry an empty agent answer as another generation', async () => {
    mocks.bootstrap.mockResolvedValue({
      systemPrompt: 'Rote',
      finalAnswerInstruction: 'Answer',
      tools: [],
      policy: { maxIterations: 6, maxToolCalls: 8, maxSourceChars: 12000 },
    });
    mocks.complete.mockResolvedValue({ message: { role: 'assistant', content: null } });
    await expect(
      localAiAgentStream({
        config,
        payload: { message: 'hello' },
        handlers: {},
        toolsAvailable: true,
        enableThinking: false,
      })
    ).rejects.toThrow('error_no_answer_no_sources');
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });
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
      policy: {
        maxIterations: 2,
        maxToolCalls: 2,
        maxSearchResultChars: 4000,
        maxSearchExcerptChars: 300,
        maxReadChars: 2000,
        maxSourceChars: 12_000,
      },
    });
    mocks.complete
      .mockImplementationOnce(async ({ onContent }) => {
        onContent?.('I will inspect the tags first.');
        return {
          message: {
            role: 'assistant',
            content: 'I will inspect the tags first.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'rote_get_tags', arguments: '{}' },
              },
            ],
          },
        };
      })
      .mockImplementationOnce(async ({ onContent }) => {
        onContent?.('final ');
        onContent?.('answer');
        return { message: { role: 'assistant', content: 'final answer', tool_calls: [] } };
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
    const onOutputDelta = vi.fn();

    await localAiAgentStream({
      config,
      payload: { message: 'show tags' },
      handlers: { onDelta, onOutputDelta },
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
    const secondRequest = mocks.complete.mock.calls[1][0] as {
      messages: Array<{ role: string; content?: string | null; tool_calls?: unknown[] }>;
    };
    expect(secondRequest.messages.find((message) => message.tool_calls)?.content).toBe(
      'I will inspect the tags first.'
    );
    expect(onOutputDelta.mock.calls.map(([output]) => output.text)).toEqual([
      'I will inspect the tags first.',
      'final ',
      'answer',
    ]);
    expect(onDelta).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledTimes(2);
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
      policy: {
        maxIterations: 2,
        maxToolCalls: 1,
        maxSearchResultChars: 4000,
        maxSearchExcerptChars: 300,
        maxReadChars: 2000,
        maxSourceChars: 12_000,
      },
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

it('merges two batches, restores reading state and sends both batches to the provider', async () => {
  mocks.bootstrap.mockResolvedValue({
    systemPrompt: 'Rote',
    finalAnswerInstruction: 'Answer',
    tools: [
      {
        type: 'function',
        function: { name: 'rote_search_notes', description: 'search', parameters: {} },
      },
    ],
    policy: { maxIterations: 4, maxToolCalls: 8, maxSourceChars: 12000 },
  });
  const call = (id: string) => ({
    message: {
      role: 'assistant',
      content: `Process ${id}`,
      reasoning_content: `Thought ${id}`,
      tool_calls: [
        { id, type: 'function', function: { name: 'rote_search_notes', arguments: '{}' } },
      ],
    },
  });
  mocks.complete
    .mockResolvedValueOnce(call('a'))
    .mockResolvedValueOnce(call('b'))
    .mockResolvedValueOnce({ message: { role: 'assistant', content: 'ready' } })
    .mockImplementationOnce(async ({ onContent }) => {
      onContent?.('answer');
      return { message: { role: 'assistant', content: 'answer' } };
    });
  const sources = Array.from({ length: 40 }, (_, i) => ({
    sourceType: 'rote',
    sourceId: `note-${i + 1}`,
    metadata: {},
    similarity: 1,
  }));
  const keys = sources.map((s) => `rote:${s.sourceId}`);
  const result = (start: number, end: number) => ({
    sources: sources.slice(start, end),
    sourceKeys: keys.slice(0, end),
    sourceCharsUsed: end * 150,
    readOffsets: { [keys[0]]: 100 },
    state: {},
    observations: [],
    modelContent: `evidence-${end}`,
    retrieval: { foundCount: 20, addedCount: 20, totalCount: end, budgetExhausted: false },
  });
  mocks.executeTool.mockResolvedValueOnce(result(0, 20)).mockResolvedValueOnce(result(20, 40));
  const onSources = vi.fn();
  await localAiAgentStream({
    config,
    payload: { message: 'review' },
    handlers: { onSources },
    toolsAvailable: true,
    enableThinking: false,
  });
  expect(onSources.mock.calls.map(([rows]) => rows.length)).toEqual([20, 40]);
  expect(onSources.mock.calls[1][1].totalCount).toBe(40);
  expect(mocks.executeTool.mock.calls[1][0]).toMatchObject({
    sourceCharsUsed: 3000,
    readOffsets: { [keys[0]]: 100 },
  });
  expect(
    mocks.complete.mock.calls
      .at(-1)?.[0]
      .messages.filter((m: { role: string }) => m.role === 'tool')
      .map((m: { content: string }) => m.content)
  ).toEqual(['evidence-20', 'evidence-40']);
  expect(
    mocks.complete.mock.calls
      .at(-1)?.[0]
      .messages.filter((m: { role: string }) => m.role === 'assistant')
  ).toMatchObject([
    { content: 'Process a', reasoning_content: 'Thought a' },
    { content: 'Process b', reasoning_content: 'Thought b' },
  ]);
});
it('stops further local tools after evidence exhaustion', async () => {
  mocks.bootstrap.mockResolvedValue({
    systemPrompt: 'Rote',
    finalAnswerInstruction: 'Answer',
    tools: [
      {
        type: 'function',
        function: { name: 'rote_search_notes', description: 'search', parameters: {} },
      },
    ],
    policy: { maxIterations: 4, maxToolCalls: 8, maxSourceChars: 12000 },
  });
  mocks.complete
    .mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: ['a', 'b'].map((id) => ({
          id,
          type: 'function',
          function: { name: 'rote_search_notes', arguments: '{}' },
        })),
      },
    })
    .mockImplementationOnce(async ({ onContent }) => {
      onContent?.('limited');
      return { message: { role: 'assistant', content: 'limited' } };
    });
  mocks.executeTool.mockResolvedValue({
    sources: [],
    sourceKeys: [],
    sourceCharsUsed: 11990,
    state: {},
    observations: [],
    modelContent: '{"status":"budget_exhausted"}',
    retrieval: { foundCount: 0, addedCount: 0, totalCount: 0, budgetExhausted: true },
  });
  const onSources = vi.fn();
  await localAiAgentStream({
    config,
    payload: { message: 'review' },
    handlers: { onSources },
    toolsAvailable: true,
    enableThinking: false,
  });
  expect(mocks.executeTool).toHaveBeenCalledTimes(1);
  expect(mocks.complete).toHaveBeenCalledTimes(2);
  expect(onSources).toHaveBeenCalledWith([], expect.objectContaining({ budgetExhausted: true }));
  expect(
    mocks.complete.mock.calls[1][0].messages.filter((m: { role: string }) => m.role === 'tool')
  ).toHaveLength(2);
});

it('tells the final local provider when a successful single result exhausts the evidence budget', async () => {
  mocks.bootstrap.mockResolvedValue({
    systemPrompt: 'Rote',
    finalAnswerInstruction: 'Answer',
    tools: [
      {
        type: 'function',
        function: { name: 'rote_search_notes', description: 'search', parameters: {} },
      },
    ],
    policy: { maxIterations: 6, maxToolCalls: 8, maxSourceChars: 12000 },
  });
  mocks.complete
    .mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'search',
            type: 'function',
            function: { name: 'rote_search_notes', arguments: '{}' },
          },
        ],
      },
    })
    .mockResolvedValueOnce({ message: { role: 'assistant', content: 'limited answer' } });
  const modelContent = JSON.stringify({
    status: 'ok',
    sources: [{ citation: 1, excerpt: 'evidence' }],
  });
  mocks.executeTool.mockResolvedValue({
    sources: [{ sourceType: 'rote', sourceId: 'note', metadata: {}, similarity: 1 }],
    sourceKeys: ['rote:note'],
    sourceCharsUsed: 11990,
    state: {},
    observations: [],
    modelContent,
    retrieval: { foundCount: 1, addedCount: 1, totalCount: 1, budgetExhausted: true },
  });
  await localAiAgentStream({
    config,
    payload: { message: 'review' },
    handlers: {},
    toolsAvailable: true,
    enableThinking: false,
  });
  expect(mocks.complete).toHaveBeenCalledTimes(2);
  const messages = mocks.complete.mock.calls[1][0].messages;
  expect(messages.filter((m: { role: string }) => m.role === 'tool')).toHaveLength(1);
  expect(messages.find((m: { role: string }) => m.role === 'tool').content).toBe(modelContent);
  expect(messages.at(-1).content).toContain('without mentioning internal reading or tool budgets');
});
