import {
  createChatCompletionStreamParts,
  createChatCompletionWithToolsStreaming,
  type ChatMessage,
  type ChatToolCall,
} from '../client';
import { buildFinalAnswerInstruction, buildRoteAgentSystemPrompt } from './prompt';
import { getNativeRoteTools } from './tools';
import {
  AgentToolCallingUnavailableError,
  DEFAULT_AGENT_POLICY,
  type RoteAgentClientState,
  type RoteAgentContext,
  type RoteAgentEmitter,
  type RoteAgentPhase,
  type RoteAgentPolicy,
  type RoteAgentRequest,
  type RoteAgentTool,
} from './types';
import { classifyAiStreamError, createAiRunId, logAiStreamLifecycle } from './observability';
import { AgentSourceBudget } from './sourceBudget';
import { sanitizeAgentState } from './state';

function parseToolArguments(call: ChatToolCall): unknown {
  try {
    return call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return {};
  }
}

function buildToolRegistryCorrection(unknownToolNames: string[], availableToolNames: string[]) {
  return [
    `The requested tool name is not registered: ${unknownToolNames.join(', ')}.`,
    `Available tools are: ${availableToolNames.join(', ')}.`,
    'Choose one of the registered tools exactly as named, or answer without tools if no tool is needed.',
  ].join('\n');
}

function isLikelyToolUnsupportedError(error: any): boolean {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('tool') ||
    message.includes('function call') ||
    message.includes('function_call') ||
    message.includes('tool_choice') ||
    message.includes('tools is not') ||
    message.includes('unsupported parameter')
  );
}

async function emitWithHeartbeat<T>(
  emit: RoteAgentEmitter,
  policy: RoteAgentPolicy,
  phase: RoteAgentPhase,
  task: () => Promise<T>
): Promise<T> {
  await emit({ type: 'progress', phase });
  let heartbeatSeq = 0;
  const timer = setInterval(() => {
    heartbeatSeq += 1;
    void Promise.resolve(
      emit({ type: 'heartbeat', phase, seq: heartbeatSeq, timestamp: new Date().toISOString() })
    ).catch(() => {});
  }, policy.heartbeatMs);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

function buildRequestTimeContextMessage(state: RoteAgentClientState): ChatMessage {
  const clientContext = state.clientContext;
  const lines = [
    '## Current request time context',
    `Server now (UTC): ${new Date().toISOString()}`,
  ];

  if (clientContext) {
    if (clientContext.nowIso) lines.push(`Client now (UTC): ${clientContext.nowIso}`);
    if (clientContext.localDate) lines.push(`Client local date: ${clientContext.localDate}`);
    if (clientContext.localDateTime) {
      lines.push(`Client local date/time: ${clientContext.localDateTime}`);
    }
    if (clientContext.timeZone) lines.push(`Client time zone: ${clientContext.timeZone}`);
    if (typeof clientContext.utcOffsetMinutes === 'number') {
      lines.push(`Client UTC offset minutes: ${clientContext.utcOffsetMinutes}`);
    }
    if (clientContext.locale) lines.push(`Client locale: ${clientContext.locale}`);
    if (clientContext.calendar) lines.push(`Client calendar: ${clientContext.calendar}`);
  } else {
    lines.push(
      'Client time context was not supplied; use server now and Asia/Shanghai for Rote date ranges.'
    );
  }

  lines.push(
    'Resolve relative date phrases such as today, yesterday, this month, last month, 最近, 本月, and 上月 using this context.',
    'When calling rote_search_notes for a relative date phrase, pass the phrase as timeExpression instead of inventing absolute from/to dates.',
    'Use from/to only when the user explicitly provides absolute dates.',
    'For broad recent/latest record reviews or recurring-theme analysis, use selection recent with a default limit of 30 and dateField createdAt. Use updatedAt for modification/activity wording. For focused topics, use selection relevance with an explicit time range.'
  );

  return { role: 'system', content: lines.join('\n') };
}

function buildInitialMessages(
  request: RoteAgentRequest,
  state: RoteAgentClientState
): ChatMessage[] {
  const mode = request.mode || 'chat';
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildRoteAgentSystemPrompt(mode),
    },
    buildRequestTimeContextMessage(state),
  ];

  if (request.history?.length) {
    messages.push(
      ...request.history.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }))
    );
  }

  messages.push({ role: 'user', content: request.message });
  return messages;
}

async function streamFinalAnswer(
  ctx: RoteAgentContext,
  messages: ChatMessage[],
  emitText: (text: string) => Promise<void>,
  signal?: AbortSignal
): Promise<{ emittedText: boolean; usage: any }> {
  await ctx.emit({ type: 'progress', phase: 'answering' });
  let emittedText = false;
  let lastUsage: any = null;

  for await (const part of createChatCompletionStreamParts(ctx.config.chat, messages, {
    usageContext: { userId: ctx.userId, purpose: 'chat_answer' },
    enableThinking: ctx.request.enableThinking === true,
    signal,
  })) {
    if (part.type === 'reasoning') {
      await ctx.emit({
        type: 'thinking',
        phase: 'answer',
        text: part.text,
        ...(ctx.request.streamOutputs ? { outputId: 'final' } : {}),
      });
    } else if (part.type === 'usage') {
      lastUsage = part.usage;
    } else if (part.type === 'content') {
      emittedText = true;
      await emitText(part.text);
    }
  }

  if (lastUsage) {
    await ctx.emit({ type: 'usage', phase: 'answer', usage: lastUsage });
  }

  return { emittedText, usage: lastUsage };
}

export async function runRoteAgentStream(params: {
  userId: string;
  request: RoteAgentRequest;
  config: RoteAgentContext['config'];
  emit: RoteAgentEmitter;
  policy?: Partial<RoteAgentPolicy>;
  runId?: string;
  signal?: AbortSignal;
  tools?: RoteAgentTool[];
}): Promise<void> {
  const request = params.request;
  const runId = params.runId || createAiRunId('agent');
  const policy = { ...DEFAULT_AGENT_POLICY, ...(params.policy || {}) };
  const tools = params.tools ?? getNativeRoteTools();
  const toolByName = new Map(tools.map((tool) => [tool.definition.function.name, tool]));
  const sourceBudget = new AgentSourceBudget({
    maxSourceChars: policy.maxSourceChars,
  });
  const state = sanitizeAgentState(request);
  const mode = request.mode || 'chat';
  let currentPhase: RoteAgentPhase = 'understanding';
  const emit: RoteAgentEmitter = async (event) => {
    if (event.type === 'progress') currentPhase = event.phase;
    await params.emit(event);
  };
  const ctx: RoteAgentContext = {
    userId: params.userId,
    requestId: runId,
    request,
    config: params.config,
    mode,
    policy,
    state,
    emit,
    sourceBudget,
  };

  const messages = buildInitialMessages(request, state);
  let toolCallCount = 0;
  let evidenceExhausted = false;
  let hasFinalAnswer = false;
  let endedWithoutTools = false;
  const emitOutput = async (outputId: string, phase: RoteAgentPhase, text: string) => {
    if (!request.streamOutputs) {
      await emit({ type: 'delta', text });
      return;
    }
    await emit({ type: 'delta', outputId, phase, text });
  };
  let totalTokens = 0;
  const startedAt = Date.now();
  const recordUsage = (usage: any) => {
    if (usage && Number.isFinite(usage.total_tokens)) totalTokens += usage.total_tokens;
  };

  logAiStreamLifecycle('info', 'started', {
    runId,
    endpoint: 'agent',
    userId: params.userId,
    model: params.config.chat.model,
    phase: currentPhase,
  });

  try {
    await emit({ type: 'run_started', runId });
    await emit({ type: 'progress', phase: 'understanding' });

    for (let step = 0; step < policy.maxIterations; step += 1) {
      const phase: RoteAgentPhase = step === 0 ? 'planning' : 'tool_calling';
      const outputId = `step-${step}`;
      const contentChunks: string[] = [];
      if (request.streamOutputs) await emit({ type: 'output_started', outputId, phase });
      let assistantMessage: ChatMessage;
      let responseUsage: Awaited<
        ReturnType<typeof createChatCompletionWithToolsStreaming>
      >['usage'];
      try {
        const response = await emitWithHeartbeat(emit, policy, phase, () =>
          createChatCompletionWithToolsStreaming(
            params.config.chat,
            messages,
            tools.map((tool) => tool.definition),
            {
              usageContext: {
                userId: params.userId,
                purpose: step === 0 ? 'chat_plan' : 'chat_tool_decision',
              },
              temperature: 0.2,
              enableThinking: request.enableThinking === true,
              signal: params.signal,
              onContent: (text) => {
                if (request.streamOutputs) return emitOutput(outputId, phase, text);
                contentChunks.push(text);
              },
              onReasoning: (text) =>
                emit({
                  type: 'thinking',
                  phase: step === 0 ? 'route_decision' : 'evidence_decision',
                  text,
                  ...(request.streamOutputs ? { outputId } : {}),
                }),
            }
          )
        );
        assistantMessage = response.message;
        responseUsage = response.usage;
        if (response.usage) {
          recordUsage(response.usage);
        }
      } catch (error: any) {
        if (step === 0 && isLikelyToolUnsupportedError(error)) {
          throw new AgentToolCallingUnavailableError(
            error.message || 'Tool calling is unavailable'
          );
        }
        throw error;
      }

      const toolCalls = assistantMessage.tool_calls || [];
      hasFinalAnswer = !toolCalls.length && !!assistantMessage.content?.trim();
      if (request.streamOutputs)
        await emit({
          type: 'output_finished',
          outputId,
          phase,
          kind: hasFinalAnswer ? 'answer' : 'process',
        });
      if (!toolCalls.length) {
        endedWithoutTools = true;
        if (hasFinalAnswer) {
          await emit({ type: 'progress', phase: 'answering' });
          if (!request.streamOutputs) {
            for (const text of contentChunks) await emit({ type: 'delta', text });
          }
        }
        if (responseUsage) {
          await emit({
            type: 'usage',
            phase: hasFinalAnswer ? 'answer' : step === 0 ? 'planning' : 'tool_decision',
            usage: responseUsage,
          });
        }
        break;
      }

      if (responseUsage) {
        await emit({
          type: 'usage',
          phase: step === 0 ? 'planning' : 'tool_decision',
          usage: responseUsage,
        });
      }

      const validToolCalls = toolCalls.filter((toolCall) => toolByName.has(toolCall.function.name));
      const unknownToolNames = Array.from(
        new Set(
          toolCalls
            .map((toolCall) => toolCall.function.name)
            .filter((toolName) => !toolByName.has(toolName))
        )
      );

      if (unknownToolNames.length > 0) {
        messages.push({
          role: 'system',
          content: buildToolRegistryCorrection(unknownToolNames, Array.from(toolByName.keys())),
        });
      }

      if (validToolCalls.length === 0) continue;

      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: validToolCalls,
      });

      for (const toolCall of validToolCalls) {
        if (toolCallCount >= policy.maxToolCalls || evidenceExhausted) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: 'skipped',
              reason: evidenceExhausted ? 'budget_exhausted' : 'tool_budget_exceeded',
              message: evidenceExhausted
                ? 'Evidence text budget exhausted; answer from delivered evidence.'
                : `Tool call ${toolCall.function.name} exceeded the tool call budget.`,
            }),
          });
          await emit({
            type: 'tool_finished',
            toolName: toolCall.function.name,
            summary: 'Skipped: tool budget exceeded',
          });
          continue;
        }
        toolCallCount += 1;

        const tool = toolByName.get(toolCall.function.name);
        const args = parseToolArguments(toolCall);
        await emit({ type: 'tool_started', toolName: toolCall.function.name, args });

        const result = await emitWithHeartbeat(emit, policy, 'tool_calling', () =>
          tool!.execute(args, ctx, toolCall)
        );

        evidenceExhausted ||= result.retrieval?.budgetExhausted === true;
        if (result.plan) await emit({ type: 'plan', plan: result.plan });
        if (result.sources)
          await emit({
            type: 'sources',
            sources: ctx.sourceBudget.list(),
            retrieval: result.retrieval,
          });
        if (result.statePatch) {
          Object.assign(ctx.state, result.statePatch);
          await emit({ type: 'state_patch', state: result.statePatch });
        }
        await emit({
          type: 'tool_finished',
          toolName: toolCall.function.name,
          summary: result.displaySummary || result.observations.join(' '),
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.modelContent,
        });

        if (result.clarification) {
          await emit({
            type: 'clarification',
            question: result.clarification.question,
            pendingPlan: result.clarification.pendingPlan,
          });
          await emit({ type: 'done' });
          logAiStreamLifecycle('info', 'completed', {
            runId,
            endpoint: 'agent',
            userId: params.userId,
            model: params.config.chat.model,
            phase: currentPhase,
            durationMs: Date.now() - startedAt,
            toolCallCount,
            sourceCount: sourceBudget.snapshot().sourceCount,
            sourceCharsUsed: sourceBudget.snapshot().sourceCharsUsed,
            totalTokens,
            outcome: 'clarification',
          });
          return;
        }
      }

      if (toolCallCount >= policy.maxToolCalls || evidenceExhausted) break;
    }

    if (!hasFinalAnswer && !endedWithoutTools) {
      messages.push({ role: 'user', content: buildFinalAnswerInstruction(evidenceExhausted) });
      if (request.streamOutputs)
        await emit({ type: 'output_started', outputId: 'final', phase: 'answering' });
      const finalAnswer = await streamFinalAnswer(
        ctx,
        messages,
        (text) => emitOutput('final', 'answering', text),
        params.signal
      );
      hasFinalAnswer = finalAnswer.emittedText;
      if (request.streamOutputs)
        await emit({
          type: 'output_finished',
          outputId: 'final',
          phase: 'answering',
          kind: 'answer',
        });
      recordUsage(finalAnswer.usage);
    }

    if (!hasFinalAnswer) {
      const errorCode =
        ctx.sourceBudget.list().length > 0
          ? 'error_no_answer_with_sources'
          : 'error_no_answer_no_sources';
      await emit({
        type: 'error',
        message: errorCode,
        code: errorCode,
        runId,
        retryable: true,
      });
      logAiStreamLifecycle('error', 'failed', {
        runId,
        endpoint: 'agent',
        userId: params.userId,
        model: params.config.chat.model,
        phase: currentPhase,
        durationMs: Date.now() - startedAt,
        toolCallCount,
        sourceCount: sourceBudget.snapshot().sourceCount,
        sourceCharsUsed: sourceBudget.snapshot().sourceCharsUsed,
        totalTokens,
        errorCode,
      });
      return;
    }

    await emit({
      type: 'state_patch',
      state: {
        seenSourceIds: ctx.state.seenSourceIds,
        previousPlan: ctx.state.previousPlan,
      },
    });
    await emit({ type: 'done' });
    logAiStreamLifecycle('info', 'completed', {
      runId,
      endpoint: 'agent',
      userId: params.userId,
      model: params.config.chat.model,
      phase: currentPhase,
      durationMs: Date.now() - startedAt,
      toolCallCount,
      sourceCount: sourceBudget.snapshot().sourceCount,
      sourceCharsUsed: sourceBudget.snapshot().sourceCharsUsed,
      totalTokens,
      outcome: 'answer',
    });
  } catch (error) {
    const failure = classifyAiStreamError(error);
    logAiStreamLifecycle('error', 'failed', {
      runId,
      endpoint: 'agent',
      userId: params.userId,
      model: params.config.chat.model,
      phase: currentPhase,
      durationMs: Date.now() - startedAt,
      toolCallCount,
      sourceCount: sourceBudget.snapshot().sourceCount,
      sourceCharsUsed: sourceBudget.snapshot().sourceCharsUsed,
      totalTokens,
      errorCode: failure.code,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
}

export { isAgentToolCallingUnavailableError, type RoteAgentStreamEvent } from './types';
