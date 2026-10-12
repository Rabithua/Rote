import { randomUUID } from 'node:crypto';
import type { AiProviderConfig } from '../types/config';
import { saveAiUsage } from './repository';
import type { AiUsageContext, AiUsageRecord } from './types';
import { readAiUsage } from './values';

export function createAiUsageRecorder(
  provider: AiProviderConfig,
  type: 'chat' | 'embedding',
  context: AiUsageContext = { purpose: 'provider_test' },
  save: (record: AiUsageRecord) => Promise<void> = saveAiUsage
) {
  const requestId = randomUUID();
  const createdAt = new Date();
  let dispatched = false;
  let values = readAiUsage(undefined, type);
  return {
    dispatch() {
      dispatched = true;
    },
    observe(raw: unknown) {
      if (!raw || typeof raw !== 'object') return;
      const observed = readAiUsage(raw, type);
      if (
        observed.promptTokens !== null ||
        observed.totalTokens !== null ||
        observed.completionTokens !== null
      ) {
        values = observed;
      }
    },
    async finish(status: AiUsageRecord['status']) {
      if (!dispatched) return;
      try {
        await save({
          requestId,
          userid: context.userId || null,
          providerId: provider.providerId,
          model: provider.model,
          type,
          purpose: context.purpose,
          status,
          usageStatus: values.totalTokens === null ? 'unknown' : 'reported',
          createdAt,
          ...values,
        });
      } catch (error) {
        // Statistics must not change the outcome of the provider request.
        // Do not log Drizzle errors: they may contain query parameters.
        // eslint-disable-next-line no-console -- Operational signal without sensitive query data.
        console.error('ai_usage_persist_failed', {
          requestId,
          errorType: error instanceof Error ? error.name : typeof error,
        });
      }
    },
  };
}
