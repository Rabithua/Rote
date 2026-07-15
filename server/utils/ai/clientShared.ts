import type { AiProviderConfig } from '../../types/config';

export type ChatToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
};

export type ChatToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export type ChatCompletionOptions = {
  temperature?: number;
  enableThinking?: boolean;
  toolChoice?: ChatToolChoice;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
  idleTimeoutMs?: number;
};

export type ToolCallingProbeResult = {
  supported: boolean;
  message: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  rawContent?: string;
  error?: string;
};

export type ChatCompletionUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type ChatCompletionStreamPart =
  | { type: 'content' | 'reasoning'; text: string }
  | {
      type: 'usage';
      usage: ChatCompletionUsage;
    };

function toTokenCount(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function normalizeUsage(
  usage: any,
  fallbackCompletionTokens = 0
): ChatCompletionUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;

  const promptTokens = toTokenCount(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens
  );
  const completionTokens = toTokenCount(
    usage.completion_tokens ??
      usage.output_tokens ??
      usage.completionTokens ??
      usage.outputTokens ??
      fallbackCompletionTokens
  );
  const explicitTotalTokens = toTokenCount(usage.total_tokens ?? usage.totalTokens);
  const totalTokens = explicitTotalTokens || promptTokens + completionTokens;

  if (totalTokens === 0) return undefined;

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function normalizeToolCalls(value: unknown): ChatToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const toolCalls = value
    .filter(
      (call: any) =>
        typeof call?.id === 'string' &&
        call?.type === 'function' &&
        typeof call?.function?.name === 'string'
    )
    .map((call: any) => ({
      id: call.id,
      type: 'function' as const,
      function: {
        name: call.function.name,
        arguments: typeof call.function.arguments === 'string' ? call.function.arguments : '{}',
      },
    }));
  return toolCalls.length ? toolCalls : undefined;
}

export function buildHeaders(config: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

function stripHtmlForErrorMessage(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
}

function buildProviderErrorMessage(response: Response, body: unknown): string {
  const rawText = typeof body === 'string' ? body : '';
  const plainText = rawText ? stripHtmlForErrorMessage(rawText) : '';
  const providerMessage =
    (body as any)?.error?.message ||
    (body as any)?.message ||
    plainText ||
    `Provider request failed with ${response.status}`;

  if (/Unable to connect|Connection Closed|SGErrorDomain|Policy:/i.test(providerMessage)) {
    return `Provider request was intercepted or closed by a local proxy. Ensure 127.0.0.1/localhost is in NO_PROXY and Surge bypass rules. ${providerMessage.slice(0, 240)}`;
  }

  return providerMessage.slice(0, 500);
}

export async function ensureProviderStreamResponse(response: Response): Promise<void> {
  if (!response.ok) {
    await readJsonResponse(response);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(buildProviderErrorMessage(response, await response.text()));
  }
}

export async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  const contentType = response.headers.get('content-type') || '';
  if (typeof body === 'string' && (contentType.includes('text/html') || looksLikeHtml(body))) {
    throw new Error(buildProviderErrorMessage(response, body));
  }

  if (!response.ok) {
    throw new Error(buildProviderErrorMessage(response, body));
  }

  return body;
}

export function ensureProviderConfig(config: AiProviderConfig): void {
  if (!config.baseUrl?.trim()) {
    throw new Error('Provider base URL is required');
  }
  if (!config.model?.trim()) {
    throw new Error('Provider model is required');
  }
}

export function buildChatRequestBody(
  config: AiProviderConfig,
  body: {
    messages: ChatMessage[];
    temperature: number;
    stream?: boolean;
    enableThinking?: boolean;
    tools?: ChatToolDefinition[];
    toolChoice?: ChatToolChoice;
  }
): Record<string, unknown> {
  return {
    model: config.model,
    messages: body.messages,
    temperature: body.temperature,
    ...(body.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    ...(body.tools?.length ? { tools: body.tools, tool_choice: body.toolChoice || 'auto' } : {}),
    ...(config.providerId === 'dashscope' && typeof body.enableThinking === 'boolean'
      ? { enable_thinking: body.enableThinking }
      : {}),
  };
}
