import { sanitizeExcludeIds } from '../../dbMethods';
import type { RoteAgentClientContext, RoteAgentClientState, RoteAgentRequest } from './types';

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

export function sanitizeAgentState(request: RoteAgentRequest): RoteAgentClientState {
  const state = request.state && typeof request.state === 'object' ? request.state : {};
  const seenSourceIds =
    sanitizeExcludeIds(state.seenSourceIds) || sanitizeExcludeIds(request.excludeIds) || [];

  return {
    conversationId:
      typeof state.conversationId === 'string' ? state.conversationId.slice(0, 200) : undefined,
    previousPlan: state.previousPlan || request.previousPlan || null,
    seenSourceIds,
    selectedContext: state.selectedContext || request.selectedContext || null,
    clientContext:
      sanitizeClientContext(state.clientContext) || sanitizeClientContext(request.clientContext),
    stateVersion: Number.isFinite(state.stateVersion) ? state.stateVersion : 1,
  };
}
