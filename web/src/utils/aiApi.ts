import { authService } from './auth';
import { get, getApiUrl, post, refreshAccessToken } from './api';
import { readAiStreamResponse } from './aiStream';
import type {
  AiAgentClientState,
  AiChatPayload,
  AiChatStreamHandlers,
  AiClientRequestContext,
  AiProviderTestProgressHandler,
  AiProviderTestResult,
  AiSemanticResult,
  AiStatus,
  ClientAgentBootstrap,
  ClientAgentToolResult,
  AiSourceType,
} from './aiTypes';

export type * from './aiTypes';

export const getAiStatus = () => get('/ai/status').then((res) => res.data as AiStatus);

export const testSiteAiProvider = (onProgress?: AiProviderTestProgressHandler) => {
  onProgress?.('site');
  return post('/ai/site/test', {}).then((res) => ({
    data: res.data as AiProviderTestResult,
    message: res.message,
  }));
};

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `${sign}${padDatePart(Math.floor(absolute / 60))}:${padDatePart(absolute % 60)}`;
}

export function createAiClientRequestContext(now = new Date()): AiClientRequestContext {
  const resolvedOptions = Intl.DateTimeFormat().resolvedOptions();
  const utcOffsetMinutes = -now.getTimezoneOffset();
  const localDate = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join('-');
  const localTime = [
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join(':');

  return {
    nowIso: now.toISOString(),
    localDate,
    localDateTime: `${localDate}T${localTime}${formatUtcOffset(utcOffsetMinutes)}`,
    timeZone: resolvedOptions.timeZone,
    utcOffsetMinutes,
    locale: typeof navigator !== 'undefined' ? navigator.language : resolvedOptions.locale,
    calendar: resolvedOptions.calendar,
  };
}

export function buildAiClientTimeContextMessage(context: AiClientRequestContext): string {
  return [
    'Use the current request time context for relative date phrases.',
    `Client now (UTC): ${context.nowIso}`,
    `Client local date: ${context.localDate}`,
    `Client local date/time: ${context.localDateTime}`,
    context.timeZone ? `Client time zone: ${context.timeZone}` : null,
    `Client UTC offset minutes: ${context.utcOffsetMinutes}`,
    context.locale ? `Client locale: ${context.locale}` : null,
    context.calendar ? `Client calendar: ${context.calendar}` : null,
    'Resolve relative date phrases such as today, yesterday, this month, last month, 最近, 本月, and 上月 using this context.',
    'For Rote search tools, prefer structured timeRange preset/rolling/relative_between or pass the original phrase as timeExpression. Use from/to only for explicit absolute dates.',
    'For broad recent/latest record reviews or recurring-theme analysis, use selection recent with a default limit of 30 and dateField createdAt. Use updatedAt for modification/activity wording. For focused topics, use selection relevance with an explicit time range.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function withAiClientRequestContext(payload: AiChatPayload): AiChatPayload {
  const clientContext = payload.clientContext || createAiClientRequestContext();
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
}

export const getClientAgentBootstrap = () =>
  get('/ai/client-agent/bootstrap').then((res) => res.data as ClientAgentBootstrap);

export const executeClientAgentTool = (payload: {
  toolName: string;
  arguments: unknown;
  request: AiChatPayload;
  state?: AiAgentClientState | null;
  sourceKeys?: string[];
  sourceCharsUsed?: number;
}) => {
  const request = withAiClientRequestContext(payload.request);
  return post('/ai/client-agent/tools/execute', {
    ...payload,
    request,
    state: payload.state
      ? {
          ...payload.state,
          clientContext: payload.state.clientContext || request.clientContext,
        }
      : payload.state,
  }).then((res) => res.data as ClientAgentToolResult);
};

async function createAiStreamRequest(
  endpoint: '/ai/chat/stream' | '/ai/agent/stream',
  payload: AiChatPayload,
  signal?: AbortSignal
) {
  const requestPayload = withAiClientRequestContext(payload);
  let token = authService.getAccessToken();
  const request = () =>
    fetch(`${getApiUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestPayload),
      signal,
    });

  let response = await request();
  if (response.status === 401 && authService.hasValidRefreshToken()) {
    token = await refreshAccessToken();
    response = await request();
  }

  return response;
}

async function readResponseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return body?.message || body?.error?.message || `Request failed with ${response.status}`;
  } catch {
    const plainText = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/Connection Closed|SGErrorDomain|Policy:/i.test(plainText)) {
      return `Local AI request was intercepted or closed by a proxy client. Add 127.0.0.1/localhost to the proxy bypass list, or try switching Base URL between http://127.0.0.1:8080/v1 and http://localhost:8080/v1. ${plainText.slice(0, 240)}`;
    }
    return plainText || text || `Request failed with ${response.status}`;
  }
}

export async function aiChatStream(
  payload: AiChatPayload,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/chat/stream', payload, signal);
  if (!response.ok) throw new Error(await readResponseError(response));
  await readAiStreamResponse(response, handlers);
}

export async function aiAgentStream(
  payload: AiChatPayload,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/agent/stream', payload, signal);
  if (!response.ok) throw new Error(await readResponseError(response));
  await readAiStreamResponse(response, handlers);
}

export const aiSearch = (payload: {
  query: string;
  scope?: 'mine' | 'public';
  sourceTypes?: AiSourceType[];
  timeRange?: { from: string; to: string; label?: string } | null;
  tags?: { include?: string[]; exclude?: string[]; match?: 'any' | 'all' };
  semanticScope?: string[];
  state?: 'private' | 'public' | 'all';
  archived?: boolean | null;
  limit?: number;
}) => post('/ai/search', payload).then((res) => res.data as AiSemanticResult[]);

export const getRelatedNotes = (payload: {
  sourceType: AiSourceType;
  sourceId: string;
  sourceTypes?: AiSourceType[];
  limit?: number;
}) => post('/ai/related-notes', payload).then((res) => res.data as AiSemanticResult[]);
