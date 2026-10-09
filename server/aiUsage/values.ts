import type { AiUsageValues } from './types';

function tokenCount(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function readAiUsage(raw: any, type: 'chat' | 'embedding'): AiUsageValues {
  const promptTokens = tokenCount(
    raw?.prompt_tokens ?? raw?.input_tokens ?? raw?.promptTokens ?? raw?.inputTokens
  );
  const completionTokens =
    type === 'embedding'
      ? 0
      : tokenCount(
          raw?.completion_tokens ?? raw?.output_tokens ?? raw?.completionTokens ?? raw?.outputTokens
        );
  const totalTokens =
    tokenCount(raw?.total_tokens ?? raw?.totalTokens) ??
    (promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null);
  return {
    promptTokens,
    completionTokens:
      type === 'embedding' && promptTokens === null && totalTokens === null
        ? null
        : completionTokens,
    totalTokens,
    cacheHitTokens: tokenCount(
      raw?.prompt_cache_hit_tokens ??
        raw?.prompt_tokens_details?.cached_tokens ??
        raw?.input_tokens_details?.cached_tokens
    ),
    cacheMissTokens: tokenCount(raw?.prompt_cache_miss_tokens),
    reasoningTokens: tokenCount(
      raw?.completion_tokens_details?.reasoning_tokens ??
        raw?.output_tokens_details?.reasoning_tokens
    ),
  };
}
