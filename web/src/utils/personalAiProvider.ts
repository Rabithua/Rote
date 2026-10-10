import { isLocalPersonalAiProvider, type PersonalAiProviderConfig } from '@/state/localAi';
import type {
  AiProviderTestProgressHandler,
  AiProviderTestResult,
  AiToolCallingProbeResult,
} from '@/utils/aiApi';
import { buildPersonalAiHeaders, getPersonalAiBaseUrlCandidates } from '@/utils/localAi';
import { buildChatParameters } from '@/utils/chatParameters';

async function readBrowserResponseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return body?.message || body?.error?.message || `personal_ai_request_failed`;
  } catch {
    const plainText = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/Connection Closed|SGErrorDomain|Policy:/i.test(plainText)) {
      return `personal_ai_proxy_intercepted`;
    }
    return plainText || text || `personal_ai_request_failed`;
  }
}

function normalizeBrowserFetchError(error: unknown, config: PersonalAiProviderConfig): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  if (error instanceof TypeError && !isLocalPersonalAiProvider(config)) {
    return new Error(`personal_ai_cors_blocked`);
  }
  return error instanceof Error ? error : new Error(`personal_ai_request_failed`);
}

async function fetchBrowserChatCompletion(
  config: PersonalAiProviderConfig,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: unknown;
  const { temperature = config.temperature, ...chatPayload } = payload;
  const parameters = isLocalPersonalAiProvider(config)
    ? { temperature, chat_template_kwargs: { enable_thinking: true } }
    : buildChatParameters(config, Number(temperature));

  for (const baseUrl of getPersonalAiBaseUrlCandidates(config)) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: buildPersonalAiHeaders(config),
        body: JSON.stringify({
          ...chatPayload,
          ...parameters,
        }),
        signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes(`text/html`)) {
        throw new Error(await readBrowserResponseError(response));
      }
      return response;
    } catch (error) {
      lastError = normalizeBrowserFetchError(error, config);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`personal_ai_request_failed`);
}

export async function testPersonalAiProvider(
  config: PersonalAiProviderConfig,
  onProgress?: AiProviderTestProgressHandler
): Promise<{ data: AiProviderTestResult; message: string }> {
  const startedAt = Date.now();
  onProgress?.(isLocalPersonalAiProvider(config) ? 'local_chat' : 'personal_remote');
  const response = await fetchBrowserChatCompletion(config, {
    model: config.model,
    messages: [
      { role: 'system', content: `You are a connectivity test endpoint.` },
      { role: 'user', content: `Reply with OK.` },
    ],
    temperature: 0,
    stream: false,
  });

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== `string`) {
    throw new Error(`personal_ai_invalid_response`);
  }
  onProgress?.('tool_calling');
  const toolCalling = await probeBrowserAiToolCalling(config);

  return {
    data: {
      success: true,
      model: config.model,
      latencyMs: Date.now() - startedAt,
      sample: content.slice(0, 120),
      usage: body?.usage,
      toolCalling,
    },
    message: toolCalling.supported
      ? `personal_ai_test_success`
      : `personal_ai_test_tool_calling_missing`,
  };
}

async function probeBrowserAiToolCalling(
  config: PersonalAiProviderConfig
): Promise<AiToolCallingProbeResult> {
  const toolName = 'rote_tool_calling_probe';
  try {
    const response = await fetchBrowserChatCompletion(config, {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `You are testing OpenAI-compatible tool calling. Call the provided tool exactly once. Do not answer with normal text.`,
        },
        {
          role: 'user',
          content: `Call rote_tool_calling_probe with token set to rote-tool-probe.`,
        },
      ],
      temperature: 0,
      stream: false,
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: `Records that the model can emit a tool call.`,
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                token: {
                  type: 'string',
                  description: `Must be rote-tool-probe.`,
                },
              },
              required: ['token'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    });

    const body = await response.json();
    const message = body?.choices?.[0]?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    const toolCall = toolCalls.find((call: any) => call?.function?.name === toolName);
    if (!toolCall) {
      return {
        supported: false,
        message: `tool_calling_no_call`,
        rawContent: typeof message?.content === `string` ? message.content : undefined,
      };
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      const args = JSON.parse(toolCall.function?.arguments || '{}');
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        parsedArgs = args;
      }
    } catch {
      return {
        supported: false,
        message: `tool_calling_invalid_arguments`,
        toolName,
        rawContent: typeof message?.content === `string` ? message.content : undefined,
      };
    }

    return {
      supported: true,
      message: `tool_calling_detected`,
      toolName,
      arguments: parsedArgs,
      rawContent: typeof message?.content === `string` ? message.content : undefined,
    };
  } catch (error: any) {
    return {
      supported: false,
      message: `tool_calling_probe_failed`,
      error: error?.message || String(error),
    };
  }
}
