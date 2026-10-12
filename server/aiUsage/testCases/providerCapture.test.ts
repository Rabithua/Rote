import { describe, expect, it } from 'bun:test';
import type { Sql } from 'postgres';
import type { AiProviderConfig } from '../../types/config';
import {
  createChatCompletion,
  createChatCompletionWithTools,
  createChatCompletionWithToolsStreaming,
  createChatCompletionStreamParts,
  probeChatProviderToolCalling,
} from '../../utils/ai/client';
import { createEmbedding } from '../../embeddings/client';

export function registerProviderCaptureTests(
  client: Sql,
  owner: string,
  provider: AiProviderConfig
) {
  const context = { userId: owner, purpose: 'chat_answer' as const };
  const usage = {
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    prompt_cache_hit_tokens: 80,
    prompt_cache_miss_tokens: 20,
    completion_tokens_details: { reasoning_tokens: 15 },
  };
  function stream(events: unknown[], disconnect = false) {
    let sent = false;
    return new Response(
      new ReadableStream({
        pull(controller) {
          if (sent) {
            if (disconnect) controller.error(new Error('disconnect'));
            else controller.close();
            return;
          }
          sent = true;
          for (const event of events)
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
          if (!disconnect) controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } }
    );
  }
  async function consume(options: Parameters<typeof createChatCompletionStreamParts>[2] = {}) {
    for await (const _part of createChatCompletionStreamParts(
      provider,
      [{ role: 'user', content: 'test' }],
      { usageContext: context, ...options }
    )) {
      /* consume */
    }
  }
  async function recorded() {
    return client`SELECT * FROM ai_token_usage_logs ORDER BY "createdAt", request_id`;
  }

  describe('provider call capture', () => {
    for (const [tools, finishReason] of [
      [false, 'length'],
      [true, 'length'],
      [false, 'content_filter'],
      [true, 'content_filter'],
    ] as const) {
      it(`captures same-frame usage before ${finishReason} validation (${tools ? 'tools' : 'answer'})`, async () => {
        globalThis.fetch = (async () =>
          stream([
            { choices: [{ delta: {}, finish_reason: finishReason }], usage },
          ])) as typeof fetch;
        const result = tools
          ? createChatCompletionWithToolsStreaming(provider, [], [], { usageContext: context })
          : consume();
        await expect(result).rejects.toMatchObject({ code: 'ai_provider_output_truncated' });
        expect(await recorded()).toHaveLength(1);
        expect((await recorded())[0]).toMatchObject({
          totalTokens: 120,
          cache_hit_tokens: 80,
          reasoning_tokens: 15,
          status: 'failed',
          usage_status: 'reported',
          userid: owner,
        });
      });
    }
    it('keeps received usage after a network disconnect', async () => {
      globalThis.fetch = (async () => stream([{ choices: [], usage }], true)) as typeof fetch;
      await expect(consume()).rejects.toThrow();
      expect((await recorded())[0]).toMatchObject({ totalTokens: 120, status: 'failed' });
    });
    it('marks a normal response with no usage as unknown', async () => {
      globalThis.fetch = (async () =>
        stream([
          { choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] },
        ])) as typeof fetch;
      await consume();
      expect((await recorded())[0]).toMatchObject({
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        status: 'completed',
        usage_status: 'unknown',
      });
    });
    it('uses the final cumulative usage and records separate calls with new request IDs', async () => {
      globalThis.fetch = (async () =>
        stream([
          { usage: { ...usage, completion_tokens: 10, total_tokens: 110 } },
          { choices: [{ delta: {}, finish_reason: 'stop' }], usage },
        ])) as typeof fetch;
      await consume();
      await consume();
      const rows = await recorded();
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.totalTokens)).toEqual([120, 120]);
      expect(rows[0].request_id).not.toBe(rows[1].request_id);
    });
    it('captures usage when the consumer cancels after receiving it', async () => {
      globalThis.fetch = (async () => stream([{ usage }])) as typeof fetch;
      for await (const part of createChatCompletionStreamParts(provider, [], {
        usageContext: context,
      })) {
        if (part.type === 'usage') break;
      }
      expect((await recorded())[0]).toMatchObject({ totalTokens: 120, status: 'cancelled' });
    });
    it('does not count an already cancelled request as an HTTP call', async () => {
      await expect(consume({ signal: AbortSignal.abort() })).rejects.toThrow();
      expect(await recorded()).toHaveLength(0);
    });
    it('keeps received usage when an external signal aborts the stream', async () => {
      const controller = new AbortController();
      globalThis.fetch = (async () => stream([{ usage }], true)) as typeof fetch;
      const task = async () => {
        for await (const part of createChatCompletionStreamParts(provider, [], {
          usageContext: context,
          signal: controller.signal,
        })) {
          if (part.type === 'usage') controller.abort();
        }
      };
      await expect(task()).rejects.toThrow();
      expect((await recorded())[0]).toMatchObject({ totalTokens: 120, status: 'cancelled' });
    });
    it('records failed HTTP attempts with no returned usage as unknown', async () => {
      globalThis.fetch = (async () => {
        throw new Error('network failure');
      }) as typeof fetch;
      await expect(consume()).rejects.toThrow();
      expect((await recorded())[0]).toMatchObject({
        totalTokens: null,
        status: 'failed',
        usage_status: 'unknown',
      });
    });
    it('captures usage before invalid non-streaming content validation', async () => {
      globalThis.fetch = (async () => Response.json({ choices: [{}], usage })) as typeof fetch;
      await expect(createChatCompletion(provider, [], { usageContext: context })).rejects.toThrow();
      expect((await recorded())[0]).toMatchObject({ totalTokens: 120, status: 'failed' });
    });
    it('captures tool probes as system calls, and each planning/decision/answer independently', async () => {
      globalThis.fetch = (async () =>
        Response.json({ choices: [{ message: { content: 'OK' } }], usage })) as typeof fetch;
      await probeChatProviderToolCalling(provider);
      for (const purpose of ['chat_plan', 'chat_tool_decision', 'chat_answer'] as const) {
        await createChatCompletionWithTools(provider, [], [], {
          usageContext: { userId: owner, purpose },
        });
      }
      const rows = await recorded();
      expect(rows).toHaveLength(4);
      expect(rows.filter((row) => row.userid === null)[0].purpose).toBe('provider_test');
      expect(
        rows
          .filter((row) => row.userid === owner)
          .map((row) => row.purpose)
          .sort()
      ).toEqual(['chat_answer', 'chat_plan', 'chat_tool_decision']);
    });
    it('records a timeout with unknown usage', async () => {
      globalThis.fetch = (async (_url, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true }
          )
        )) as typeof fetch;
      await expect(consume({ requestTimeoutMs: 5 })).rejects.toMatchObject({
        code: 'ai_provider_timeout',
      });
      expect((await recorded())[0]).toMatchObject({
        totalTokens: null,
        status: 'failed',
        usage_status: 'unknown',
      });
    });
    it('records embedding usage before dimensional validation and attributes query/index/system purposes', async () => {
      globalThis.fetch = (async () =>
        Response.json({
          data: [{ embedding: [1, 2, 3] }],
          usage: { prompt_tokens: 9, total_tokens: 9 },
        })) as typeof fetch;
      const embeddingProvider = {
        ...provider,
        model: 'embedding-test',
        output: { mode: 'native' as const },
      };
      for (const purpose of ['embedding_query', 'embedding_index', 'index_validation'] as const) {
        await expect(
          createEmbedding(embeddingProvider, 'text', {
            expectedDimensions: 4,
            usageContext: { userId: purpose === 'index_validation' ? undefined : owner, purpose },
          })
        ).rejects.toThrow();
      }
      expect(await recorded()).toHaveLength(3);
      for (const row of await recorded())
        expect(row).toMatchObject({
          totalTokens: 9,
          completionTokens: 0,
          status: 'failed',
          usage_status: 'reported',
        });
      expect(
        (await recorded()).filter((row) => row.purpose === 'index_validation')[0].userid
      ).toBeNull();
    });
  });
}
