import {
  createChatCompletion,
  createChatCompletionStreamParts,
  type ChatMessage,
  type ChatCompletionUsage,
} from './client';
import { getStoredAiConfig } from '../dbMethods/ai';
import { logAiTokenUsage } from '../dbMethods/aiToken';
import type { RetrievalTimeContext } from './retrievalPlan';

function buildMessages(
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  clientContext?: RetrievalTimeContext | null
): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildTimeContextMessage(clientContext),
    },
  ];
  if (Array.isArray(history)) {
    messages.push(...history.slice(-8));
  }
  messages.push({ role: 'user', content: message });
  return messages;
}

function buildTimeContextMessage(clientContext?: RetrievalTimeContext | null): string {
  const lines = [
    'Use the current request time context for relative date phrases.',
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
  } else {
    lines.push(
      'Client time context was not supplied; use server now and Asia/Shanghai by default.'
    );
  }

  return lines.join('\n');
}

async function logUsage(userId: string, model: string, usage: ChatCompletionUsage) {
  await logAiTokenUsage({
    userid: userId,
    model,
    type: 'chat',
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });
}

export async function createDirectSiteChat(params: {
  userId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientContext?: RetrievalTimeContext | null;
  enableThinking?: boolean;
  signal?: AbortSignal;
}) {
  const config = await getStoredAiConfig();
  const result = await createChatCompletion(
    config.chat,
    buildMessages(params.message, params.history, params.clientContext),
    {
      enableThinking: params.enableThinking,
      signal: params.signal,
    }
  );
  if (result.usage) await logUsage(params.userId, config.chat.model, result.usage);
  return result.content;
}

export async function streamDirectSiteChat(params: {
  userId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientContext?: RetrievalTimeContext | null;
  enableThinking?: boolean;
  signal?: AbortSignal;
  onReasoning: (text: string) => Promise<void>;
  onContent: (text: string) => Promise<void>;
  onUsage: (usage: ChatCompletionUsage) => Promise<void>;
}) {
  const config = await getStoredAiConfig();
  let usage: ChatCompletionUsage | undefined;
  for await (const part of createChatCompletionStreamParts(
    config.chat,
    buildMessages(params.message, params.history, params.clientContext),
    { enableThinking: params.enableThinking, signal: params.signal }
  )) {
    if (part.type === 'reasoning') await params.onReasoning(part.text);
    if (part.type === 'content') await params.onContent(part.text);
    if (part.type === 'usage') usage = part.usage;
  }
  if (usage) {
    await logUsage(params.userId, config.chat.model, usage);
    await params.onUsage(usage);
  }
}
