import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as usageRepository from '../aiUsage/repository';
import { DEFAULT_AI_CONFIG } from '../utils/ai/providers';
import {
  DEFAULT_AGENT_POLICY,
  type RoteAgentContext,
  type RoteAgentStreamEvent,
  type RoteAgentTool,
} from '../utils/ai/agent/types';
import { AgentSourceBudget } from '../utils/ai/agent/sourceBudget';
import { createEmbedding } from '../embeddings/client';

const originalFetch = globalThis.fetch;
beforeEach(() => {
  spyOn(usageRepository, 'saveAiUsage').mockResolvedValue(undefined);
});
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});
const config = structuredClone(DEFAULT_AI_CONFIG);
config.chat = { providerId: 'test', baseUrl: 'http://test', model: 'chat' };
config.embedding = {
  providerId: 'test',
  baseUrl: 'http://test',
  model: 'embedding',
  output: { mode: 'native' },
};

function toolResponse() {
  const chunk = {
    choices: [
      {
        delta: {
          tool_calls: [0, 1].map((index) => ({
            index,
            id: `call-${index}`,
            function: { name: 'search', arguments: JSON.stringify({ index }) },
          })),
        },
        finish_reason: 'tool_calls',
      },
    ],
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}
function searchTool(execute: RoteAgentTool['execute']): RoteAgentTool {
  return {
    definition: {
      type: 'function',
      function: { name: 'search', description: 'Search', parameters: { type: 'object' } },
    },
    execute,
  };
}

describe('agent cancellation', () => {
  for (const name of ['rote_search_notes', 'rote_find_related_notes']) {
    it(`passes cancellation through the native ${name} lookup before any embedding request`, async () => {
      const { getNativeRoteTools } = await import('../utils/ai/agent/tools');
      const retrieval = await import('../utils/ai/retrievalScope');
      const methods = await import('../utils/dbMethods');
      const controller = new AbortController();
      const reason = new DOMException('Stopped', 'AbortError');
      if (name === 'rote_search_notes') {
        spyOn(retrieval, 'getUserRoteTags').mockImplementation(async () => {
          controller.abort(reason);
          return [];
        });
      } else {
        spyOn(methods, 'findRoteById').mockImplementation(async () => {
          controller.abort(reason);
          return { id: 'note', authorid: 'owner', content: 'Note body' } as Awaited<
            ReturnType<typeof methods.findRoteById>
          >;
        });
      }
      let requests = 0;
      globalThis.fetch = (async () => {
        requests++;
        return Response.json({});
      }) as typeof fetch;
      const ctx: RoteAgentContext = {
        userId: 'owner',
        requestId: 'run',
        request: { message: 'review' },
        config,
        mode: 'review',
        policy: DEFAULT_AGENT_POLICY,
        state: {},
        emit: () => {},
        sourceBudget: new AgentSourceBudget({ maxSourceChars: 12000 }),
        signal: controller.signal,
      };
      const tool = getNativeRoteTools().find((tool) => tool.definition.function.name === name)!;
      await expect(
        tool.execute({ query: 'review', sourceId: 'note' }, ctx, {
          id: 'call',
          type: 'function',
          function: { name, arguments: '{}' },
        })
      ).rejects.toBe(reason);
      expect(requests).toBe(0);
    });
  }

  it('does not dispatch a provider request when already stopped', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    controller.abort(reason);
    let requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return toolResponse();
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await expect(
      runRoteAgentStream({
        userId: 'owner',
        request: { message: 'review' },
        config,
        signal: controller.signal,
        emit: (event) => {
          events.push(event);
        },
      })
    ).rejects.toBe(reason);
    expect(requests).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('cancels a running embedding and skips remaining tools and the next model round', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    let queryStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      queryStarted = resolve;
    });
    let chatRequests = 0;
    let embeddingRequests = 0;
    let embeddingSignal: AbortSignal | undefined;
    globalThis.fetch = (async (url, init) => {
      if (String(url).endsWith('/chat/completions')) {
        chatRequests++;
        return toolResponse();
      }
      embeddingRequests++;
      embeddingSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        embeddingSignal?.addEventListener('abort', () => reject(embeddingSignal?.reason), {
          once: true,
        });
        queryStarted();
      });
    }) as typeof fetch;
    const executions: number[] = [];
    const events: RoteAgentStreamEvent[] = [];
    const run = runRoteAgentStream({
      userId: 'owner',
      request: { message: 'review', streamOutputs: true },
      config,
      signal: controller.signal,
      emit: (event) => {
        events.push(event);
      },
      tools: [
        searchTool(async (args, ctx) => {
          expect(ctx.signal).toBe(controller.signal);
          executions.push((args as { index: number }).index);
          await createEmbedding(ctx.config.embedding, 'query', { signal: ctx.signal });
          return { modelContent: '{}', observations: [] };
        }),
      ],
    });
    await started;
    controller.abort(reason);
    await expect(run).rejects.toBe(reason);
    expect(embeddingSignal?.aborted).toBe(true);
    expect(executions).toEqual([0]);
    expect(chatRequests).toBe(1);
    expect(embeddingRequests).toBe(1);
    expect(events.some((event) => event.type === 'done' || event.type === 'tool_finished')).toBe(
      false
    );
  });

  it('stops between completed tool work and result delivery even if that tool ignores cancellation', async () => {
    const { runRoteAgentStream } = await import('../utils/ai/agent/runtime');
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    let requests = 0;
    let executions = 0;
    globalThis.fetch = (async () => {
      requests++;
      return toolResponse();
    }) as typeof fetch;
    const events: RoteAgentStreamEvent[] = [];
    await expect(
      runRoteAgentStream({
        userId: 'owner',
        request: { message: 'review' },
        config,
        signal: controller.signal,
        emit: (event) => {
          events.push(event);
        },
        tools: [
          searchTool(async () => {
            executions++;
            controller.abort(reason);
            return { modelContent: '{}', observations: [] };
          }),
        ],
      })
    ).rejects.toBe(reason);
    expect(executions).toBe(1);
    expect(requests).toBe(1);
    expect(events.some((event) => event.type === 'tool_finished' || event.type === 'done')).toBe(
      false
    );
  });
});
