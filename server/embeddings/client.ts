import { createAiUsageRecorder } from '../aiUsage/recording';
import type { AiUsageContext, AiUsageRecord } from '../aiUsage/types';
import type { EmbeddingProviderConfig } from '../types/config';
import { buildHeaders, normalizeBaseUrl, normalizeUsage } from '../utils/ai/clientShared';
import { embeddingOutputSchema, validateVector } from './contract';
import { EmbeddingError } from './errors';

export async function createEmbedding(
  config: EmbeddingProviderConfig,
  input: string,
  options: { expectedDimensions?: number; timeoutMs?: number; usageContext?: AiUsageContext } = {}
): Promise<{ embedding: number[]; usage?: { prompt_tokens: number; total_tokens: number } }> {
  const output = embeddingOutputSchema.safeParse(config.output);
  if (!output.success || !config.baseUrl.trim() || !config.model.trim()) {
    throw new EmbeddingError('embedding_config_invalid', 400);
  }
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) throw new EmbeddingError('embedding_input_empty', 400);
  const signal = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const recorder = createAiUsageRecorder(config, 'embedding', options.usageContext);
  let status: AiUsageRecord['status'] = 'failed';
  try {
    let response: Response;
    let raw: string;
    try {
      recorder.dispatch();
      response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/embeddings`, {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify({
          model: config.model.trim(),
          input: text,
          ...(output.data.mode === 'dimensions' ? { dimensions: output.data.dimensions } : {}),
        }),
        signal,
      });
      raw = await response.text();
    } catch {
      throw new EmbeddingError(
        signal.aborted ? 'embedding_timeout' : 'embedding_network_error',
        signal.aborted ? 504 : 502,
        {},
        true
      );
    }
    let body: { data?: { embedding?: unknown }[]; usage?: unknown } | undefined;
    try {
      body = JSON.parse(raw);
    } catch {
      // HTTP failures retain their status-based error even when the body is not JSON.
      if (response.ok) throw new EmbeddingError('embedding_response_invalid');
    }
    recorder.observe(body?.usage);
    if (!response.ok) {
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      const code =
        response.status === 401 || response.status === 403
          ? 'embedding_auth_failed'
          : response.status === 429
            ? 'embedding_rate_limited'
            : retryable
              ? 'embedding_provider_unavailable'
              : 'embedding_parameter_rejected';
      throw new EmbeddingError(code, 502, { providerStatus: response.status }, retryable);
    }
    const expected =
      output.data.mode === 'dimensions' ? output.data.dimensions : options.expectedDimensions;
    const embedding = validateVector(body?.data?.[0]?.embedding, expected);
    if (options.expectedDimensions !== undefined)
      validateVector(embedding, options.expectedDimensions);
    status = 'completed';
    return { embedding, usage: normalizeUsage(body?.usage) };
  } finally {
    await recorder.finish(status);
  }
}

export async function testEmbeddingProvider(config: EmbeddingProviderConfig) {
  const { embedding } = await createEmbedding(config, 'Rote embedding connectivity test.');
  return { dimensions: embedding.length, output: config.output };
}
