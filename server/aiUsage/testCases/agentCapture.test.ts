import { describe, expect, it } from 'bun:test';
import type { Sql } from 'postgres';
import type { AiProviderConfig } from '../../types/config';
import { DEFAULT_AI_CONFIG } from '../../utils/ai/providers';
import { runRoteAgentStream } from '../../utils/ai/agent/runtime';
import type { RoteAgentStreamEvent, RoteAgentTool } from '../../utils/ai/agent/types';

export function registerAgentCaptureTests(client: Sql, owner: string, provider: AiProviderConfig) {
  const tool: RoteAgentTool = {
    definition: {
      type: 'function',
      function: { name: 'inspect', description: 'Inspect test evidence', parameters: {} },
    },
    execute: async () => ({ observations: [], modelContent: '{"status":"ready"}' }),
  };
  const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 };

  describe('agent HTTP call usage', () => {
    for (const streamOutputs of [false, true]) {
      for (const scenario of [
        { name: 'direct answer', tools: false, iterations: 6, purposes: ['chat_plan'] },
        {
          name: 'reused answer after a tool',
          tools: true,
          iterations: 6,
          purposes: ['chat_plan', 'chat_tool_decision'],
        },
        {
          name: 'dedicated final answer at the iteration limit',
          tools: true,
          iterations: 1,
          purposes: ['chat_plan', 'chat_answer'],
        },
      ]) {
        it(`records ${scenario.name} once per HTTP call (streamOutputs=${streamOutputs})`, async () => {
          let calls = 0;
          globalThis.fetch = (async () => {
            calls++;
            const toolCall = scenario.tools && calls === 1;
            const event = {
              choices: [
                {
                  delta: toolCall
                    ? {
                        tool_calls: [
                          {
                            index: 0,
                            id: 'inspect-call',
                            function: { name: 'inspect', arguments: '{}' },
                          },
                        ],
                      }
                    : { content: 'Answer' },
                  finish_reason: toolCall ? 'tool_calls' : 'stop',
                },
              ],
              usage,
            };
            return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
              headers: { 'content-type': 'text/event-stream' },
            });
          }) as typeof fetch;
          const events: RoteAgentStreamEvent[] = [];
          await runRoteAgentStream({
            userId: owner,
            request: { message: 'Inspect notes', streamOutputs },
            config: { ...structuredClone(DEFAULT_AI_CONFIG), chat: provider },
            tools: scenario.tools ? [tool] : [],
            policy: { maxIterations: scenario.iterations },
            emit: (event) => {
              events.push(event);
            },
          });
          expect(events.some((event) => event.type === 'error')).toBe(false);
          expect(events.filter((event) => event.type === 'done')).toHaveLength(1);
          expect(
            events.filter((event) => event.type === 'usage' && event.phase === 'answer')
          ).toHaveLength(1);
          expect(calls).toBe(scenario.purposes.length);
          const rows = await client`SELECT * FROM ai_token_usage_logs ORDER BY "createdAt"`;
          expect(rows).toHaveLength(calls);
          expect(new Set(rows.map((row) => row.request_id)).size).toBe(calls);
          expect(rows.map((row) => row.purpose)).toEqual(scenario.purposes);
          for (const row of rows) {
            expect(row).toMatchObject({
              userid: owner,
              model: provider.model,
              type: 'chat',
              status: 'completed',
              usage_status: 'reported',
              totalTokens: 120,
            });
          }
          expect(rows.reduce((total, row) => total + row.totalTokens, 0)).toBe(calls * 120);
        });
      }
    }
  });
}
