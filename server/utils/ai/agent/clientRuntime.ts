import type { AiConfig } from '../../../types/config';
import { sanitizeExcludeIds } from '../../dbMethods';
import type { ChatToolCall } from '../client';
import { getNativeRoteTools } from './tools';
import {
  DEFAULT_AGENT_POLICY,
  type RoteAgentClientContext,
  type RoteAgentClientState,
  type RoteAgentContext,
  type RoteAgentRequest,
} from './types';
import { AgentSourceBudget } from './sourceBudget';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizeUtcOffsetMinutes(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const minutes = Math.trunc(numeric);
  return minutes >= -14 * 60 && minutes <= 14 * 60 ? minutes : undefined;
}

function sanitizeClientContext(value: unknown): RoteAgentClientContext | null {
  const raw = asRecord(value);
  if (!Object.keys(raw).length) return null;

  const context: RoteAgentClientContext = {
    nowIso: sanitizeString(raw.nowIso, 64),
    localDate: sanitizeString(raw.localDate, 32),
    localDateTime: sanitizeString(raw.localDateTime, 64),
    timeZone: sanitizeString(raw.timeZone, 80),
    utcOffsetMinutes: sanitizeUtcOffsetMinutes(raw.utcOffsetMinutes),
    locale: sanitizeString(raw.locale, 32),
    calendar: sanitizeString(raw.calendar, 32),
  };

  return Object.values(context).some((item) => item !== undefined) ? context : null;
}

function sanitizeRequest(value: unknown): RoteAgentRequest {
  const request = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  const message = typeof request.message === 'string' ? request.message.trim() : '';
  if (!message) throw new Error('Message is required');

  return {
    message,
    mode:
      request.mode === 'review' || request.mode === 'organize' || request.mode === 'chat'
        ? request.mode
        : 'chat',
    history: Array.isArray(request.history)
      ? request.history
          .filter(
            (item: any) =>
              (item?.role === 'user' || item?.role === 'assistant') &&
              typeof item?.content === 'string'
          )
          .slice(-8)
      : undefined,
    state: request.state,
    selectedContext: request.selectedContext,
    limit: Number.isFinite(request.limit) ? Number(request.limit) : undefined,
    previousPlan: request.previousPlan,
    excludeIds: sanitizeExcludeIds(request.excludeIds),
    pendingPlan: request.pendingPlan,
    clarificationAnswer:
      typeof request.clarificationAnswer === 'string' ? request.clarificationAnswer : undefined,
    clientContext: sanitizeClientContext(request.clientContext),
  };
}

function sanitizeState(value: unknown): RoteAgentClientState {
  const state = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  return {
    conversationId:
      typeof state.conversationId === 'string' ? state.conversationId.slice(0, 200) : undefined,
    previousPlan: state.previousPlan || null,
    seenSourceIds: sanitizeExcludeIds(state.seenSourceIds) || [],
    selectedContext: state.selectedContext || null,
    clientContext: sanitizeClientContext(state.clientContext),
    stateVersion: Number.isFinite(state.stateVersion) ? Number(state.stateVersion) : 1,
  };
}

export async function executeClientRoteTool(params: {
  userId: string;
  config: AiConfig;
  toolName: unknown;
  arguments: unknown;
  request: unknown;
  state: unknown;
  sourceKeys: unknown;
  sourceCharsUsed?: unknown;
}) {
  const toolName = typeof params.toolName === 'string' ? params.toolName.trim() : '';
  const tool = getNativeRoteTools().find(
    (candidate) => candidate.definition.function.name === toolName
  );
  if (!tool) throw new Error('Unknown Rote AI tool');

  const request = sanitizeRequest(params.request);
  const state = sanitizeState(params.state);
  if (!state.clientContext && request.clientContext) {
    state.clientContext = request.clientContext;
  }
  const sourceBudget = new AgentSourceBudget({
    maxSources: DEFAULT_AGENT_POLICY.maxSources,
    maxSourceChars: DEFAULT_AGENT_POLICY.maxSourceChars,
    sourceKeys: sanitizeExcludeIds(params.sourceKeys) || [],
    sourceCharsUsed: Number(params.sourceCharsUsed),
  });
  const call: ChatToolCall = {
    id: `client_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'function',
    function: {
      name: toolName,
      arguments: JSON.stringify(params.arguments ?? {}),
    },
  };
  const ctx: RoteAgentContext = {
    userId: params.userId,
    requestId: call.id,
    request,
    config: params.config,
    mode: request.mode || 'chat',
    policy: DEFAULT_AGENT_POLICY,
    state,
    emit: () => {},
    registerSources: (sources) => sourceBudget.register(sources),
    consumeSourceText: (value, requestedChars) => sourceBudget.consumeText(value, requestedChars),
    getSourceBudget: () => sourceBudget.snapshot(),
    getSources: () => sourceBudget.list(),
  };

  const result = await tool.execute(params.arguments ?? {}, ctx, call);
  if (result.statePatch) Object.assign(state, result.statePatch);

  return {
    ...result,
    state,
    sourceKeys: sourceBudget.keys(),
    sourceCharsUsed: sourceBudget.snapshot().sourceCharsUsed,
  };
}
