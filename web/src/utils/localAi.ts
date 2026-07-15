import { isLocalPersonalAiProvider, type PersonalAiProviderConfig } from '@/state/localAi';
import type { AiTokenUsage } from '@/utils/aiApi';
import { AiStreamError } from '@/utils/aiStream';
import {
  assertPersonalAiFinishReason,
  assertPersonalAiStreamComplete,
  createPersonalAiStreamControl,
} from '@/utils/aiProviderStream';

const TERMINAL_USAGE_GRACE_MS = 1_000;

export type LocalChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type LocalChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: LocalChatToolCall[];
};

export type LocalChatToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export function normalizePersonalAiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getPersonalAiBaseUrlCandidates(config: PersonalAiProviderConfig): string[] {
  const normalized = normalizePersonalAiBaseUrl(config.baseUrl);
  if (!normalized) return [];

  const candidates = [normalized];
  if (!isLocalPersonalAiProvider(config)) return candidates;

  try {
    const url = new URL(normalized);
    const alternate =
      url.hostname === '127.0.0.1' ? 'localhost' : url.hostname === 'localhost' ? '127.0.0.1' : '';
    if (alternate) {
      url.hostname = alternate;
      candidates.push(url.toString().replace(/\/+$/, ''));
    }
  } catch {
    return candidates;
  }

  return Array.from(new Set(candidates));
}

export function buildPersonalAiHeaders(config: PersonalAiProviderConfig) {
  return {
    'Content-Type': 'application/json',
    ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
  };
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return (
      body?.error?.message || body?.message || `Personal model request failed (${response.status})`
    );
  } catch {
    return text || `Personal model request failed (${response.status})`;
  }
}

function tokenCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeUsage(value: any): AiTokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const promptTokens = tokenCount(value.prompt_tokens ?? value.promptTokens);
  const completionTokens = tokenCount(value.completion_tokens ?? value.completionTokens);
  const totalTokens =
    tokenCount(value.total_tokens ?? value.totalTokens) || promptTokens + completionTokens;
  if (!totalTokens) return undefined;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

function parseToolCallArguments(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '{}';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function testLocalAiConnection(config: PersonalAiProviderConfig): Promise<void> {
  let lastError: unknown;
  for (const baseUrl of getPersonalAiBaseUrlCandidates(config)) {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: buildPersonalAiHeaders(config),
      });
      if (response.ok) return;
      lastError = new Error(await readError(response));
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`personal_ai_request_failed`);
}

export async function streamLocalChatCompletion(params: {
  config: PersonalAiProviderConfig;
  messages: LocalChatMessage[];
  tools?: LocalChatToolDefinition[];
  enableThinking?: boolean;
  signal?: AbortSignal;
  onReasoning?: (text: string) => void;
  onContent?: (text: string) => void;
  requestTimeoutMs?: number;
  idleTimeoutMs?: number;
}): Promise<{ message: LocalChatMessage; usage?: AiTokenUsage }> {
  const requestBody = JSON.stringify({
    model: params.config.model,
    messages: params.messages,
    temperature: params.config.temperature,
    stream: true,
    stream_options: { include_usage: true },
    ...(isLocalPersonalAiProvider(params.config)
      ? { chat_template_kwargs: { enable_thinking: params.enableThinking === true } }
      : {}),
    ...(params.tools?.length ? { tools: params.tools, tool_choice: 'auto' } : {}),
  });
  let response: Response | null = null;
  let lastError: unknown;
  const control = createPersonalAiStreamControl(params);

  try {
    for (const baseUrl of getPersonalAiBaseUrlCandidates(params.config)) {
      try {
        const candidate = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: buildPersonalAiHeaders(params.config),
          body: requestBody,
          signal: control.signal,
        });
        if (!candidate.ok) throw new Error(await readError(candidate));
        response = candidate;
        break;
      } catch (error) {
        const normalizedError = control.normalizeError(error);
        if (normalizedError !== error || isAbortError(error)) throw normalizedError;
        lastError = error;
      }
    }

    if (!response) {
      throw lastError instanceof Error ? lastError : new Error(`personal_ai_request_failed`);
    }
    if (!response.body) throw new Error(`Personal model returned an empty stream`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const toolCalls = new Map<number, LocalChatToolCall>();
    let buffer = '';
    let content = '';
    let usage: AiTokenUsage | undefined;
    let doneReceived = false;
    let finishReason: string | null = null;

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const data = trimmed.slice(5).trim();
      if (!data) return;
      if (data === '[DONE]') {
        doneReceived = true;
        return;
      }

      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        return;
      }

      const nextFinishReason = chunk?.choices?.[0]?.finish_reason;
      if (typeof nextFinishReason === 'string' && nextFinishReason) {
        assertPersonalAiFinishReason(nextFinishReason);
        finishReason = nextFinishReason;
      }

      const delta = chunk?.choices?.[0]?.delta || {};
      const reasoning = delta.reasoning_content || delta.reasoning;
      if (typeof reasoning === 'string' && reasoning) params.onReasoning?.(reasoning);
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        params.onContent?.(delta.content);
      }

      if (Array.isArray(delta.tool_calls)) {
        delta.tool_calls.forEach((raw: any) => {
          const index = Number.isInteger(raw?.index) ? raw.index : toolCalls.size;
          const existing =
            toolCalls.get(index) ||
            ({
              id: typeof raw?.id === 'string' ? raw.id : `local_call_${index}`,
              type: 'function',
              function: { name: '', arguments: '' },
            } satisfies LocalChatToolCall);
          if (typeof raw?.id === 'string') existing.id = raw.id;
          if (typeof raw?.function?.name === 'string') existing.function.name += raw.function.name;
          if (raw?.function?.arguments !== undefined) {
            existing.function.arguments += parseToolCallArguments(raw.function.arguments);
          }
          toolCalls.set(index, existing);
        });
      }

      usage = normalizeUsage(chunk?.usage) || usage;
    };

    try {
      while (!doneReceived) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await control.read(
            reader,
            finishReason ? TERMINAL_USAGE_GRACE_MS : undefined
          );
        } catch (error) {
          if (
            finishReason &&
            error instanceof AiStreamError &&
            error.code === 'ai_provider_timeout'
          ) {
            break;
          }
          throw error;
        }
        const { done, value } = readResult;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        lines.forEach(processLine);
      }
      buffer += decoder.decode();
      if (!doneReceived && buffer.trim()) processLine(buffer);
      assertPersonalAiStreamComplete({ doneReceived, finishReason });
    } finally {
      reader.releaseLock();
    }

    return {
      message: {
        role: 'assistant',
        content: content || null,
        tool_calls: Array.from(toolCalls.values()).filter((call) => call.function.name),
      },
      usage,
    };
  } catch (error) {
    throw control.normalizeError(error);
  } finally {
    control.cleanup();
  }
}
