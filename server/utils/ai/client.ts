import type { AiProviderConfig } from '../../types/config';
import {
  buildChatRequestBody,
  buildHeaders,
  ensureProviderConfig,
  normalizeBaseUrl,
  normalizeToolCalls,
  normalizeUsage,
  readJsonResponse,
} from './clientShared';
import type {
  ChatCompletionOptions,
  ChatCompletionUsage,
  ChatMessage,
  ChatToolDefinition,
  ToolCallingProbeResult,
} from './clientShared';
import { createProviderStreamControl } from './clientStreamControl';

export type {
  ChatCompletionOptions,
  ChatCompletionStreamPart,
  ChatCompletionUsage,
  ChatMessage,
  ChatToolCall,
  ChatToolChoice,
  ChatToolDefinition,
  ToolCallingProbeResult,
} from './clientShared';
export {
  createChatCompletionStream,
  createChatCompletionStreamParts,
  createChatCompletionWithToolsStreaming,
} from './clientStream';
export {
  AiProviderStreamError,
  isAiProviderStreamError,
  type AiProviderStreamErrorCode,
} from './clientStreamControl';

export { createEmbedding, testEmbeddingProvider } from '../../embeddings/client';

export async function createChatCompletion(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<{
  content: string;
  usage?: ChatCompletionUsage;
}> {
  ensureProviderConfig(config);
  const control = createProviderStreamControl(options);

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(
        buildChatRequestBody(config, {
          messages,
          temperature: options.temperature ?? 0.2,
          enableThinking: options.enableThinking,
        })
      ),
      signal: control.signal,
    });
    const body = await readJsonResponse(response);
    const content = body?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('Chat provider returned an invalid chat completion response');
    }

    return {
      content,
      usage: normalizeUsage(body?.usage),
    };
  } catch (error) {
    throw control.normalizeError(error);
  } finally {
    control.cleanup();
  }
}

export async function createChatCompletionWithTools(
  config: AiProviderConfig,
  messages: ChatMessage[],
  tools: ChatToolDefinition[],
  options: ChatCompletionOptions = {}
): Promise<{
  message: ChatMessage;
  usage?: ChatCompletionUsage;
}> {
  ensureProviderConfig(config);
  const control = createProviderStreamControl(options);

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(
        buildChatRequestBody(config, {
          messages,
          tools,
          toolChoice: options.toolChoice ?? 'auto',
          temperature: options.temperature ?? 0.2,
          enableThinking: options.enableThinking,
        })
      ),
      signal: control.signal,
    });
    const body = await readJsonResponse(response);
    const message = body?.choices?.[0]?.message;

    if (!message || typeof message !== 'object') {
      throw new Error('Chat provider returned an invalid tool completion response');
    }

    return {
      message: {
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : null,
        tool_calls: normalizeToolCalls(message.tool_calls),
      },
      usage: normalizeUsage(body?.usage),
    };
  } catch (error) {
    throw control.normalizeError(error);
  } finally {
    control.cleanup();
  }
}

export async function testChatProvider(config: AiProviderConfig): Promise<void> {
  await createChatCompletion(config, [
    { role: 'system', content: 'You are a connectivity test endpoint.' },
    { role: 'user', content: 'Reply with OK.' },
  ]);
}

export async function probeChatProviderToolCalling(
  config: AiProviderConfig
): Promise<ToolCallingProbeResult> {
  const toolName = 'rote_tool_calling_probe';

  try {
    const response = await createChatCompletionWithTools(
      config,
      [
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
      [
        {
          type: 'function',
          function: {
            name: toolName,
            description: 'Records that the model can emit a tool call.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                token: {
                  type: 'string',
                  description: 'Must be rote-tool-probe.',
                },
              },
              required: ['token'],
            },
          },
        },
      ],
      {
        temperature: 0,
        toolChoice: 'auto',
      }
    );

    const toolCall = response.message.tool_calls?.find((call) => call.function.name === toolName);
    if (!toolCall) {
      return {
        supported: false,
        message: 'Chat works, but no tool call was returned by the model.',
        rawContent: response.message.content || undefined,
      };
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        parsedArgs = args;
      }
    } catch {
      return {
        supported: false,
        message: 'A tool call was returned, but its arguments were not valid JSON.',
        toolName,
        rawContent: response.message.content || undefined,
      };
    }

    return {
      supported: true,
      message: 'Tool calling detected.',
      toolName,
      arguments: parsedArgs,
      rawContent: response.message.content || undefined,
    };
  } catch (error: any) {
    return {
      supported: false,
      message: 'Tool calling probe failed.',
      error: error?.message || String(error),
    };
  }
}

export function vectorToLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toString()).join(',')}]`;
}
