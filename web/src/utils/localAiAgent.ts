import type { PersonalAiProviderConfig } from '@/state/localAi';
import {
  buildAiClientTimeContextMessage,
  executeClientAgentTool,
  getClientAgentBootstrap,
  withAiClientRequestContext,
  type AiAgentClientState,
  type AiChatPayload,
  type AiChatStreamHandlers,
  type AiSemanticResult,
} from '@/utils/aiApi';
import {
  streamLocalChatCompletion,
  type LocalChatMessage,
  type LocalChatToolCall,
} from '@/utils/localAi';

const PERSONAL_ASSISTANT_PROMPT = `You are a helpful assistant using the user-selected model from this browser. Answer in the active conversation language.`;

function parseArguments(call: LocalChatToolCall): unknown {
  try {
    return call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return {};
  }
}

function mergeSources(
  current: Map<string, AiSemanticResult>,
  sources: AiSemanticResult[],
  sourceKeys: string[]
) {
  sources.forEach((source) => current.set(`${source.sourceType}:${source.sourceId}`, source));
  return sourceKeys.map((key) => current.get(key)).filter(Boolean) as AiSemanticResult[];
}

export async function localAiAgentStream(params: {
  config: PersonalAiProviderConfig;
  payload: AiChatPayload;
  handlers: AiChatStreamHandlers;
  toolsAvailable: boolean;
  enableThinking: boolean;
  signal?: AbortSignal;
}) {
  const payload = withAiClientRequestContext(params.payload);
  const clientContext = payload.clientContext;
  const bootstrap = params.toolsAvailable ? await getClientAgentBootstrap() : null;
  const messages: LocalChatMessage[] = [
    {
      role: 'system',
      content: bootstrap?.systemPrompt || PERSONAL_ASSISTANT_PROMPT,
    },
    ...(clientContext
      ? [{ role: 'system' as const, content: buildAiClientTimeContextMessage(clientContext) }]
      : []),
    ...(payload.history || []).slice(-8),
    { role: 'user', content: payload.message },
  ];
  const sourceMap = new Map<string, AiSemanticResult>();
  let sourceKeys: string[] = [];
  let sourceCharsUsed = 0;
  let state: AiAgentClientState = payload.state || { stateVersion: 1, seenSourceIds: [] };
  let toolCallCount = 0;
  let hasAnswer = false;
  const availableToolNames = new Set(bootstrap?.tools.map((tool) => tool.function.name) || []);

  params.handlers.onRunStarted?.(`local_${Date.now()}`);
  params.handlers.onProgress?.('understanding');

  if (!bootstrap) {
    params.handlers.onProgress?.('answering');
    const response = await streamLocalChatCompletion({
      config: params.config,
      messages,
      enableThinking: params.enableThinking,
      signal: params.signal,
      onReasoning: (text) => params.handlers.onThinking?.('answer', text),
      onContent: (text) => params.handlers.onDelta?.(text),
    });
    if (!response.message.content?.trim()) {
      throw new Error(`Personal model did not return a usable answer`);
    }
    if (response.usage) params.handlers.onUsage?.(response.usage, 'answer');
    params.handlers.onDone?.();
    return;
  }

  for (let step = 0; step < bootstrap.policy.maxIterations; step += 1) {
    params.handlers.onProgress?.(step === 0 ? 'planning' : 'tool_calling');
    const response = await streamLocalChatCompletion({
      config: params.config,
      messages,
      tools: bootstrap.tools,
      enableThinking: params.enableThinking,
      signal: params.signal,
      onReasoning: (text) =>
        params.handlers.onThinking?.(step === 0 ? 'route_decision' : 'evidence_decision', text),
    });
    const calls = response.message.tool_calls || [];
    if (!calls.length) {
      if (response.message.content) {
        hasAnswer = true;
        params.handlers.onDelta?.(response.message.content);
      }
      if (response.usage)
        params.handlers.onUsage?.(response.usage, hasAnswer ? 'answer' : 'planning');
      break;
    }

    const validCalls = calls.filter((call) => availableToolNames.has(call.function.name));
    const unknownToolNames = Array.from(
      new Set(
        calls
          .map((call) => call.function.name)
          .filter((toolName) => !availableToolNames.has(toolName))
      )
    );
    if (unknownToolNames.length) {
      messages.push({
        role: 'system',
        content: `Unknown tool name: ${unknownToolNames.join(', ')}. Available tools: ${Array.from(
          availableToolNames
        ).join(', ')}.`,
      });
    }
    if (!validCalls.length) continue;

    if (response.usage) {
      params.handlers.onUsage?.(response.usage, step === 0 ? 'planning' : 'tool_decision');
    }
    messages.push({ role: 'assistant', content: null, tool_calls: validCalls });

    for (const call of validCalls) {
      if (toolCallCount >= bootstrap.policy.maxToolCalls) {
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            status: 'skipped',
            reason: 'tool_budget_exceeded',
            toolName: call.function.name,
          }),
        });
        params.handlers.onToolFinished?.(call.function.name);
        continue;
      }
      toolCallCount += 1;
      const args = parseArguments(call);
      params.handlers.onToolStarted?.(call.function.name, args);
      const result = await executeClientAgentTool({
        toolName: call.function.name,
        arguments: args,
        request: payload,
        state,
        sourceKeys,
        sourceCharsUsed,
      });
      state = result.state;
      sourceKeys = result.sourceKeys;
      sourceCharsUsed = Number.isFinite(result.sourceCharsUsed)
        ? Math.min(Math.max(Math.floor(result.sourceCharsUsed), 0), bootstrap.policy.maxSourceChars)
        : sourceCharsUsed;
      if (result.plan) params.handlers.onPlan?.(result.plan);
      if (result.statePatch) params.handlers.onStatePatch?.(result.statePatch);
      if (result.sources.length) {
        params.handlers.onSources?.(mergeSources(sourceMap, result.sources, sourceKeys));
      }
      params.handlers.onToolFinished?.(
        call.function.name,
        typeof result.displaySummary === 'string'
          ? result.displaySummary
          : result.observations.join(' ')
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result.modelContent,
      });
      if (result.clarification) {
        params.handlers.onClarification?.(result.clarification);
        params.handlers.onDone?.();
        return;
      }
    }

    if (toolCallCount >= bootstrap.policy.maxToolCalls) break;
  }

  if (!hasAnswer) {
    params.handlers.onProgress?.('answering');
    messages.push({ role: 'user', content: bootstrap.finalAnswerInstruction });
    const response = await streamLocalChatCompletion({
      config: params.config,
      messages,
      enableThinking: params.enableThinking,
      signal: params.signal,
      onReasoning: (text) => params.handlers.onThinking?.('answer', text),
      onContent: (text) => params.handlers.onDelta?.(text),
    });
    if (!response.message.content?.trim()) {
      throw new Error(
        sourceMap.size > 0 ? 'error_no_answer_with_sources' : 'error_no_answer_no_sources'
      );
    }
    if (response.usage) params.handlers.onUsage?.(response.usage, 'answer');
  }

  params.handlers.onStatePatch?.(state);
  params.handlers.onDone?.();
}
