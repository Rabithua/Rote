import { describe, expect, it } from 'bun:test';
import type { Sql } from 'postgres';
import type { AiProviderConfig } from '../../types/config';
import {
  createChatCompletion,
  createChatCompletionWithTools,
  createChatCompletionWithToolsStreaming,
  createChatCompletionStreamParts,
} from '../../utils/ai/client';
import { createEmbedding } from '../../embeddings/client';

export function registerHttpErrorUsageTests(
  client: Sql,
  owner: string,
  provider: AiProviderConfig
) {
  const context = { userId: owner, purpose: 'chat_answer' as const };
  const calls = [
    { name: 'chat', run: () => createChatCompletion(provider, [], { usageContext: context }) },
    {
      name: 'tools',
      run: () => createChatCompletionWithTools(provider, [], [], { usageContext: context }),
    },
    {
      name: 'stream',
      run: async () => {
        for await (const _part of createChatCompletionStreamParts(provider, [], {
          usageContext: context,
        })) {
          /* consume */
        }
      },
    },
    {
      name: 'tools stream',
      run: () =>
        createChatCompletionWithToolsStreaming(provider, [], [], { usageContext: context }),
    },
    {
      name: 'embedding',
      run: () =>
        createEmbedding({ ...provider, output: { mode: 'native' } }, 'text', {
          usageContext: { userId: owner, purpose: 'embedding_query' },
        }),
    },
  ];

  describe('usage in HTTP error responses', () => {
    for (const call of calls) {
      const embedding = call.name === 'embedding';
      const usage = embedding
        ? { prompt_tokens: 9, total_tokens: 9 }
        : {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            prompt_cache_hit_tokens: 80,
            prompt_cache_miss_tokens: 20,
            completion_tokens_details: { reasoning_tokens: 15 },
          };
      for (const scenario of [
        { name: 'JSON with usage', status: 500, reported: true, html: false },
        { name: 'JSON without usage', status: 429, reported: false, html: false },
        { name: 'HTML without usage', status: 503, reported: false, html: true },
      ]) {
        it(`${call.name}: keeps ${scenario.name} and the existing HTTP error`, async () => {
          globalThis.fetch = (async () =>
            scenario.html
              ? new Response('<html><body>upstream unavailable</body></html>', {
                  status: scenario.status,
                  headers: { 'content-type': 'text/html' },
                })
              : Response.json(
                  {
                    error: { message: 'provider billed failure' },
                    ...(scenario.reported ? { usage } : {}),
                  },
                  { status: scenario.status }
                )) as typeof fetch;
          const result = call.run();
          if (embedding) {
            await expect(result).rejects.toMatchObject({
              code:
                scenario.status === 429
                  ? 'embedding_rate_limited'
                  : 'embedding_provider_unavailable',
              status: 502,
              details: { providerStatus: scenario.status },
              retryable: true,
            });
          } else {
            await expect(result).rejects.toThrow(
              scenario.html ? 'upstream unavailable' : 'provider billed failure'
            );
          }
          const rows = await client`SELECT * FROM ai_token_usage_logs`;
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            userid: owner,
            type: embedding ? 'embedding' : 'chat',
            purpose: embedding ? 'embedding_query' : 'chat_answer',
            status: 'failed',
            usage_status: scenario.reported ? 'reported' : 'unknown',
            promptTokens: scenario.reported ? usage.prompt_tokens : null,
            completionTokens: scenario.reported ? (embedding ? 0 : 20) : null,
            totalTokens: scenario.reported ? usage.total_tokens : null,
            cache_hit_tokens: scenario.reported && !embedding ? 80 : null,
            cache_miss_tokens: scenario.reported && !embedding ? 20 : null,
            reasoning_tokens: scenario.reported && !embedding ? 15 : null,
          });
        });
      }
    }
  });
}
