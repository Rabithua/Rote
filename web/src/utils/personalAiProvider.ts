import { isLocalPersonalAiProvider, type PersonalAiProviderConfig } from '@/state/localAi';
import type {
  AiProviderTestProgressHandler,
  AiProviderTestResult,
  AiToolCallingProbeResult,
} from '@/utils/aiApi';
import { streamLocalChatCompletion } from '@/utils/localAi';

function normalizeBrowserFetchError(error: unknown, config: PersonalAiProviderConfig): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  if (error instanceof TypeError && !isLocalPersonalAiProvider(config)) {
    return new Error('personal_ai_cors_blocked');
  }
  return error instanceof Error ? error : new Error('personal_ai_request_failed');
}

export async function testPersonalAiProvider(
  config: PersonalAiProviderConfig,
  onProgress?: AiProviderTestProgressHandler
): Promise<{ data: AiProviderTestResult; message: string }> {
  const startedAt = Date.now();
  onProgress?.(isLocalPersonalAiProvider(config) ? 'local_chat' : 'personal_remote');
  let result: Awaited<ReturnType<typeof streamLocalChatCompletion>>;
  try {
    result = await streamLocalChatCompletion({
      config,
      messages: [
        { role: 'system', content: 'You are a connectivity test endpoint.' },
        { role: 'user', content: 'Reply with OK.' },
      ],
    });
  } catch (error) {
    throw normalizeBrowserFetchError(error, config);
  }
  const content = result.message.content;
  if (typeof content !== 'string') throw new Error('personal_ai_invalid_response');
  onProgress?.('tool_calling');
  const toolCalling = await probeBrowserAiToolCalling(config);
  return {
    data: {
      success: true,
      model: config.model,
      latencyMs: Date.now() - startedAt,
      sample: content.slice(0, 120),
      usage: result.usage,
      toolCalling,
    },
    message: toolCalling.supported
      ? 'personal_ai_test_success'
      : 'personal_ai_test_tool_calling_missing',
  };
}

async function probeBrowserAiToolCalling(
  config: PersonalAiProviderConfig
): Promise<AiToolCallingProbeResult> {
  const toolName = 'rote_tool_calling_probe';
  try {
    const response = await streamLocalChatCompletion({
      config,
      messages: [
        {
          role: 'system',
          content:
            'You are testing OpenAI-compatible tool calling. Call the provided tool exactly once. Do not answer with normal text.',
        },
        {
          role: 'user',
          content: 'Call rote_tool_calling_probe with token set to rote-tool-probe.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: 'Records that the model can emit a tool call.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                token: { type: 'string', description: 'Must be rote-tool-probe.' },
              },
              required: ['token'],
            },
          },
        },
      ],
    });
    const message = response.message;
    const toolCall = message.tool_calls?.find((call) => call.function.name === toolName);
    if (!toolCall) {
      return {
        supported: false,
        message: 'tool_calling_no_call',
        rawContent: message.content || undefined,
      };
    }
    let parsedArgs: Record<string, unknown> = {};
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      if (args && typeof args === 'object' && !Array.isArray(args)) parsedArgs = args;
    } catch {
      return {
        supported: false,
        message: 'tool_calling_invalid_arguments',
        toolName,
        rawContent: message.content || undefined,
      };
    }
    return {
      supported: true,
      message: 'tool_calling_detected',
      toolName,
      arguments: parsedArgs,
      rawContent: message.content || undefined,
    };
  } catch (error) {
    return {
      supported: false,
      message: 'tool_calling_probe_failed',
      error: normalizeBrowserFetchError(error, config).message,
    };
  }
}
