import type { ChatCompletionUsage } from '../../utils/ai/client';

export type AiChatStreamMetrics = {
  phase: 'understanding' | 'planning' | 'answering';
  toolCallCount: number;
  sourceCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function createAiChatStreamMetrics(): AiChatStreamMetrics {
  return {
    phase: 'understanding',
    toolCallCount: 0,
    sourceCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
}

export function addAiChatStreamUsage(
  metrics: AiChatStreamMetrics,
  usage?: ChatCompletionUsage
): void {
  if (!usage) return;
  metrics.promptTokens += usage.prompt_tokens;
  metrics.completionTokens += usage.completion_tokens;
  metrics.totalTokens += usage.total_tokens;
}
