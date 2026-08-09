import type { AiConfig } from '../../types/config';
import {
  createChatCompletionWithToolsStreaming,
  isAiProviderStreamError,
  type ChatCompletionUsage,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolDefinition,
} from './client';
import { getTodayInTimeContext, normalizeTimeZone, toDateString } from './retrievalDate';
import {
  canonicalizeSearchRotesArgs,
  getUserRoteTagCounts,
  getUserRoteTags,
} from './retrievalScope';
import type {
  PlannerAgentDto,
  PlannerAgentResult,
  PlannerDebugTrace,
  RetrievalTimeContext,
  SearchRotesArgs,
  SearchRotesProbeExecutor,
} from './retrievalTypes';
import type { SearchRotesProbeResult } from './retrievalTypes';

export * from './retrievalTypes';
export {
  canonicalizeSearchRotesArgs,
  getUserRoteTagCounts,
  getUserRoteTags,
} from './retrievalScope';
export { canonicalizeTimeRange } from './retrievalTimeRange';
export { normalizeTimeRangeInput } from './retrievalDateParsing';
export { lifecycleScopeToArchived } from './retrievalScope';

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;
const MAX_STEPS = 6;
const MAX_TOOL_CALLS = 10;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clampLimit(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(numeric), 1), MAX_LIMIT);
}

export function toPlannerAgentDto(result: PlannerAgentResult): PlannerAgentDto {
  return {
    originalMessage: result.originalMessage,
    retrievalNeeded: result.retrievalNeeded,
    scope: result.scope,
    toolResult: result.toolResult,
    clarification: result.clarification,
    debugTrace: result.debugTrace,
  };
}

function parseToolArguments(call: ChatToolCall): unknown {
  try {
    return call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return {};
  }
}

function plannerTools(): ChatToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'search_rotes',
        description:
          'Probe the current user Rote notes/articles. Use when the answer depends on user memory. Unknown tags will be treated as semantic keywords.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            excludeTags: { type: 'array', items: { type: 'string' } },
            semanticScope: { type: 'array', items: { type: 'string' } },
            selection: {
              type: 'string',
              enum: ['relevance', 'recent'],
              description:
                'Use relevance for focused topic lookup. Use recent for broad analysis of the latest records; recent ignores semantic query ranking.',
            },
            dateField: {
              type: 'string',
              enum: ['createdAt', 'updatedAt'],
              description:
                'Date basis for recent retrieval: createdAt for recently written records, updatedAt for recently modified/activity records.',
            },
            sourceTypes: { type: 'array', items: { type: 'string', enum: ['rote', 'article'] } },
            timeRange: {
              type: 'object',
              description:
                'Preferred structured time range. Use this instead of free-text from/to for dates.',
              properties: {
                type: {
                  type: 'string',
                  enum: ['absolute', 'rolling', 'relative_between', 'preset'],
                },
                preset: {
                  type: 'string',
                  enum: ['today', 'yesterday', 'this_month', 'last_month'],
                },
                fromDate: { type: 'string' },
                toDate: { type: 'string' },
                amount: { type: 'number', description: 'For rolling ranges, e.g. 7.' },
                unit: {
                  type: 'string',
                  enum: ['day', 'week', 'month', 'year'],
                  description: 'For rolling ranges.',
                },
                fromRelative: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number' },
                    unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
                    direction: { type: 'string', enum: ['ago'] },
                  },
                },
                toRelative: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number' },
                    unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
                    direction: { type: 'string', enum: ['ago'] },
                  },
                },
                label: { type: 'string' },
              },
            },
            timeExpression: {
              type: 'string',
              description:
                'Relative range expression such as today, yesterday, last 7 days, or 最近7天.',
            },
            from: { type: 'string' },
            to: { type: 'string' },
            lifecycleScope: {
              type: 'string',
              enum: ['active', 'archived', 'all', 'unspecified'],
              description: 'Note lifecycle scope only. This maps to archived/unarchived storage.',
            },
            taskStatusScope: {
              type: 'string',
              enum: ['open', 'closed', 'all', 'unspecified'],
              description: 'Task/open-loop semantic scope only.',
            },
            limit: { type: 'number' },
            cursor: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_tags',
        description: 'List user tags when exact tag filtering is needed.',
        parameters: { type: 'object', properties: { limit: { type: 'number' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'finish',
        description:
          'Finish planning. Either use the last search_rotes result, or state that retrieval is not needed.',
        parameters: {
          type: 'object',
          properties: {
            useLastSearch: { type: 'boolean' },
            retrievalNeeded: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_clarification',
        description: 'Ask the user one concise clarification question before retrieval.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' }, reason: { type: 'string' } },
          required: ['question'],
        },
      },
    },
  ];
}

function buildPlannerSystemPrompt(context?: RetrievalTimeContext): string {
  const timeZone = normalizeTimeZone(context?.timeZone);
  const today = toDateString(getTodayInTimeContext(context));
  const localDateTime = context?.localDateTime || context?.localDate || today;
  return `You are the Rote retrieval planner. Today is ${today} in ${timeZone}.
Client local date/time: ${localDateTime}.
Server now (UTC): ${new Date().toISOString()}.

Use tools only. Decide whether Rote memory is needed, what to probe, whether another probe is needed, or whether to ask a clarification.

Tools:
- search_rotes probes notes/articles and returns canonicalized scope plus lightweight snippets.
- list_tags is only for exact tag decisions.
- finish ends planning; it may only use the last search_rotes result or declare retrievalNeeded=false.
- request_clarification asks a concise user-facing question.

Keep lifecycleScope and taskStatusScope independent. lifecycleScope is note archived/unarchived lifecycle. taskStatusScope is task/open-loop semantics and must not stand in for archived state.
For relative date phrases, prefer structured timeRange preset/rolling/relative_between or pass the original phrase as timeExpression. Do not invent absolute from/to dates unless the user explicitly supplied absolute dates.
For broad questions about recent/latest records, recurring themes, or recent trends, set selection to recent, use limit 30 when no count is requested, and use dateField createdAt unless the user asks about modifications or activity. For a focused topic within a recent window, use selection relevance plus an explicit timeRange/timeExpression. Never leave a clear recent request as an unbounded relevance search.
Do not answer the user here.`;
}

function createEmptyTrace(): PlannerDebugTrace {
  return { toolCalls: [], canonicalizedArgs: [], warnings: [], probeCounts: [] };
}

function noRetrievalResult(
  message: string,
  trace: ReturnType<typeof createEmptyTrace>,
  reason: string
): PlannerAgentResult {
  return {
    originalMessage: message,
    retrievalNeeded: false,
    scope: null,
    toolResult: null,
    sources: [],
    clarification: null,
    debugTrace: { ...trace, finishReason: reason },
  };
}

export async function createRetrievalPlan(params: {
  ownerId: string;
  message: string;
  config: AiConfig;
  history?: { role: 'user' | 'assistant'; content: string }[];
  executeSearch: SearchRotesProbeExecutor;
  completeWithTools?: typeof createChatCompletionWithToolsStreaming;
  availableTags?: string[];
  excludeIds?: string[];
  getTagCounts?: () => Promise<Array<{ name: string; count: number }>>;
  maxSteps?: number;
  maxToolCalls?: number;
  enableThinking?: boolean;
  timeContext?: RetrievalTimeContext | null;
  onThinkingDelta?: (text: string) => Promise<void> | void;
  onUsage?: (usage: ChatCompletionUsage) => Promise<void> | void;
  signal?: AbortSignal;
}): Promise<PlannerAgentResult> {
  const trace = createEmptyTrace();
  const availableTags = params.availableTags || (await getUserRoteTags(params.ownerId));
  const messages: ChatMessage[] = [
    { role: 'system', content: buildPlannerSystemPrompt(params.timeContext || undefined) },
  ];
  if (params.history?.length) {
    messages.push(...params.history.slice(-8).map((message) => ({ ...message })));
  }
  messages.push({ role: 'user', content: params.message });

  let lastSearch: SearchRotesProbeResult | null = null;
  let toolCallCount = 0;
  const toolDefinitions = plannerTools();
  const completeWithTools = params.completeWithTools || createChatCompletionWithToolsStreaming;
  const maxSteps = params.maxSteps ?? MAX_STEPS;
  const maxToolCalls = params.maxToolCalls ?? MAX_TOOL_CALLS;

  for (let step = 0; step < maxSteps; step += 1) {
    let response: Awaited<ReturnType<typeof createChatCompletionWithToolsStreaming>>;
    try {
      response = await completeWithTools(params.config.chat, messages, toolDefinitions, {
        temperature: 0,
        enableThinking: params.enableThinking === true,
        onReasoning: params.onThinkingDelta,
        signal: params.signal,
      });
    } catch (error: any) {
      if (isAiProviderStreamError(error) || error?.name === 'AbortError') throw error;
      trace.providerError = error?.message || String(error);
      trace.fallbackReason = 'provider_error';
      return noRetrievalResult(params.message, trace, 'provider_error');
    }

    if (response.usage) await params.onUsage?.(response.usage);
    const calls = response.message.tool_calls || [];
    if (!calls.length) {
      trace.fallbackReason = 'assistant_returned_no_tool_call';
      return noRetrievalResult(params.message, trace, 'assistant_returned_no_tool_call');
    }
    messages.push({
      role: 'assistant',
      content: response.message.content || null,
      tool_calls: calls,
    });

    for (const call of calls) {
      if (toolCallCount >= maxToolCalls) {
        trace.fallbackReason = 'tool_call_budget_exceeded';
        return lastSearch
          ? {
              originalMessage: params.message,
              retrievalNeeded: true,
              scope: lastSearch.toolResult.canonicalizedArgs,
              toolResult: lastSearch.toolResult,
              sources: lastSearch.sources,
              clarification: null,
              debugTrace: trace,
            }
          : noRetrievalResult(params.message, trace, 'tool_call_budget_exceeded');
      }
      toolCallCount += 1;
      const args = parseToolArguments(call);
      trace.toolCalls.push({ step, name: call.function.name, args });

      if (call.function.name === 'search_rotes') {
        const { scope, warnings } = canonicalizeSearchRotesArgs({
          ownerId: params.ownerId,
          args: asRecord(args) as SearchRotesArgs,
          availableTags,
          message: params.message,
          excludeIds: params.excludeIds,
          timeContext: params.timeContext,
        });
        const probe = await params.executeSearch(scope);
        lastSearch = {
          toolResult: {
            ...probe.toolResult,
            warnings: Array.from(new Set([...warnings, ...probe.toolResult.warnings])),
          },
          sources: probe.sources,
        };
        trace.canonicalizedArgs.push(scope);
        trace.warnings.push(...warnings, ...probe.toolResult.warnings);
        trace.probeCounts.push(probe.toolResult.resultCount);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(lastSearch.toolResult),
        });
      } else if (call.function.name === 'list_tags') {
        const limit = clampLimit(asRecord(args).limit);
        const tags = (
          await (params.getTagCounts || (() => getUserRoteTagCounts(params.ownerId)))()
        ).slice(0, limit);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'ok', tags }),
        });
      } else if (call.function.name === 'finish') {
        const raw = asRecord(args);
        const reason = typeof raw.reason === 'string' ? raw.reason : 'finish';
        trace.finishReason = reason;
        if (raw.useLastSearch === true && lastSearch) {
          return {
            originalMessage: params.message,
            retrievalNeeded: true,
            scope: lastSearch.toolResult.canonicalizedArgs,
            toolResult: lastSearch.toolResult,
            sources: lastSearch.sources,
            clarification: null,
            debugTrace: trace,
          };
        }
        if (raw.retrievalNeeded === false) return noRetrievalResult(params.message, trace, reason);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            status: 'error',
            message: 'finish must useLastSearch=true after search_rotes or retrievalNeeded=false',
          }),
        });
      } else if (call.function.name === 'request_clarification') {
        const raw = asRecord(args);
        const question =
          typeof raw.question === 'string' && raw.question.trim()
            ? raw.question.trim()
            : 'Can you clarify what you want to search?';
        return {
          originalMessage: params.message,
          retrievalNeeded: false,
          scope: null,
          toolResult: null,
          sources: [],
          clarification: {
            question,
            reason: typeof raw.reason === 'string' ? raw.reason : undefined,
          },
          debugTrace: trace,
        };
      } else {
        trace.warnings.push(`unknown_tool:${call.function.name}`);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'error', message: 'Unknown planner tool' }),
        });
      }
    }
  }

  trace.fallbackReason = 'max_steps_exceeded';
  return lastSearch
    ? {
        originalMessage: params.message,
        retrievalNeeded: true,
        scope: lastSearch.toolResult.canonicalizedArgs,
        toolResult: lastSearch.toolResult,
        sources: lastSearch.sources,
        clarification: null,
        debugTrace: trace,
      }
    : noRetrievalResult(params.message, trace, 'max_steps_exceeded');
}
