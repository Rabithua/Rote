import type { AiProviderConfig } from '../../types/config';
import {
  buildChatRequestBody,
  buildHeaders,
  ensureProviderConfig,
  ensureProviderStreamResponse,
  normalizeBaseUrl,
  normalizeToolCalls,
  normalizeUsage,
  type ChatCompletionOptions,
  type ChatCompletionStreamPart,
  type ChatCompletionUsage,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolDefinition,
} from './clientShared';
import {
  assertProviderFinishReason,
  assertProviderStreamComplete,
  AiProviderStreamError,
  createProviderStreamControl,
  readProviderFinishReason,
} from './clientStreamControl';

const TERMINAL_USAGE_GRACE_MS = 1_000;

type ProviderSseData = { done: true } | { done: false; chunk: any } | null;

function parseProviderSseLine(line: string): ProviderSseData {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) return null;

  const data = trimmed.slice(5).trim();
  if (data === '[DONE]') return { done: true };

  try {
    return { done: false, chunk: JSON.parse(data) };
  } catch {
    return null;
  }
}

function buildToolStreamResult(
  content: string,
  toolCallsByIndex: Map<number, ChatToolCall>,
  usage?: ChatCompletionUsage
) {
  return {
    message: {
      role: 'assistant' as const,
      content: content || null,
      tool_calls: normalizeToolCalls(Array.from(toolCallsByIndex.values())),
    },
    usage,
  };
}

export async function createChatCompletionWithToolsStreaming(
  config: AiProviderConfig,
  messages: ChatMessage[],
  tools: ChatToolDefinition[],
  options: ChatCompletionOptions & {
    onReasoning?: (text: string) => Promise<void> | void;
    onContent?: (text: string) => Promise<void> | void;
  } = {}
): Promise<{
  message: ChatMessage;
  usage?: ChatCompletionUsage;
}> {
  ensureProviderConfig(config);
  const control = createProviderStreamControl(options);
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(
        buildChatRequestBody(config, {
          messages,
          tools,
          toolChoice: options.toolChoice || 'auto',
          temperature: options.temperature ?? 0.2,
          stream: true,
          enableThinking: options.enableThinking,
        })
      ),
      signal: control.signal,
    });

    await ensureProviderStreamResponse(response);
    if (!response.body) throw new Error('Chat provider returned an empty tool stream response');

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const toolCallsByIndex = new Map<number, ChatToolCall>();
    let buffer = '';
    let content = '';
    let usage: ChatCompletionUsage | undefined;
    let doneReceived = false;
    let finishReason: string | null = null;

    const processLine = async (line: string) => {
      const parsed = parseProviderSseLine(line);
      if (!parsed) return;
      if (parsed.done) {
        doneReceived = true;
        return;
      }

      const chunk = parsed.chunk;
      const nextFinishReason = readProviderFinishReason(chunk);
      if (nextFinishReason) {
        assertProviderFinishReason(nextFinishReason);
        finishReason = nextFinishReason;
      }

      const delta = chunk?.choices?.[0]?.delta || {};
      const reasoning = delta.reasoning_content || delta.reasoning;
      if (typeof reasoning === 'string' && reasoning.length > 0) {
        await options.onReasoning?.(reasoning);
      }

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content;
        await options.onContent?.(delta.content);
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const deltaCall of delta.tool_calls) {
          const index = Number.isInteger(deltaCall?.index)
            ? deltaCall.index
            : toolCallsByIndex.size;
          const existing =
            toolCallsByIndex.get(index) ||
            ({
              id: typeof deltaCall?.id === 'string' ? deltaCall.id : `call_${index}`,
              type: 'function',
              function: { name: '', arguments: '' },
            } satisfies ChatToolCall);

          if (typeof deltaCall?.id === 'string') existing.id = deltaCall.id;
          if (typeof deltaCall?.function?.name === 'string') {
            existing.function.name += deltaCall.function.name;
          }
          if (typeof deltaCall?.function?.arguments === 'string') {
            existing.function.arguments += deltaCall.function.arguments;
          }
          toolCallsByIndex.set(index, existing);
        }
      }

      const chunkUsage = normalizeUsage(chunk?.usage);
      if (chunkUsage) usage = chunkUsage;
    };

    while (!doneReceived) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await control.read(reader, finishReason ? TERMINAL_USAGE_GRACE_MS : undefined);
      } catch (error) {
        if (
          finishReason &&
          error instanceof AiProviderStreamError &&
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
      for (const line of lines) await processLine(line);
    }

    buffer += decoder.decode();
    if (!doneReceived && buffer.trim()) await processLine(buffer);
    assertProviderStreamComplete({ doneReceived, finishReason });
    return buildToolStreamResult(content, toolCallsByIndex, usage);
  } catch (error) {
    throw control.normalizeError(error);
  } finally {
    reader?.releaseLock();
    control.cleanup();
  }
}

export async function* createChatCompletionStreamParts(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<ChatCompletionStreamPart> {
  ensureProviderConfig(config);
  const control = createProviderStreamControl(options);
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(
        buildChatRequestBody(config, {
          messages,
          temperature: options.temperature ?? 0.2,
          stream: true,
          enableThinking: options.enableThinking,
        })
      ),
      signal: control.signal,
    });

    await ensureProviderStreamResponse(response);
    if (!response.body) throw new Error('Chat provider returned an empty stream response');

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneReceived = false;
    let finishReason: string | null = null;

    while (!doneReceived) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await control.read(reader, finishReason ? TERMINAL_USAGE_GRACE_MS : undefined);
      } catch (error) {
        if (
          finishReason &&
          error instanceof AiProviderStreamError &&
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

      for (const line of lines) {
        const parsed = parseProviderSseLine(line);
        if (!parsed) continue;
        if (parsed.done) {
          doneReceived = true;
          break;
        }

        const chunk = parsed.chunk;
        const nextFinishReason = readProviderFinishReason(chunk);
        if (nextFinishReason) {
          assertProviderFinishReason(nextFinishReason);
          finishReason = nextFinishReason;
        }

        const delta = chunk?.choices?.[0]?.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          yield { type: 'reasoning', text: reasoning };
        }

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'content', text: delta.content };
        }

        const usage = normalizeUsage(chunk?.usage);
        if (usage) yield { type: 'usage', usage };
      }
    }

    buffer += decoder.decode();
    if (!doneReceived && buffer.trim()) {
      const parsed = parseProviderSseLine(buffer);
      if (parsed?.done) {
        doneReceived = true;
      } else if (parsed && !parsed.done) {
        const nextFinishReason = readProviderFinishReason(parsed.chunk);
        if (nextFinishReason) {
          assertProviderFinishReason(nextFinishReason);
          finishReason = nextFinishReason;
        }
        const delta = parsed.chunk?.choices?.[0]?.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          yield { type: 'reasoning', text: reasoning };
        }
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          yield { type: 'content', text: delta.content };
        }
        const usage = normalizeUsage(parsed.chunk?.usage);
        if (usage) yield { type: 'usage', usage };
      }
    }

    assertProviderStreamComplete({ doneReceived, finishReason });
  } catch (error) {
    throw control.normalizeError(error);
  } finally {
    reader?.releaseLock();
    control.cleanup();
  }
}

export async function* createChatCompletionStream(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  for await (const part of createChatCompletionStreamParts(config, messages, options)) {
    if (part.type === 'content') yield part.text;
  }
}
