import type { AiConfig } from '../types/config';
import { readAiSnapshot, parseIncomingAiConfig } from './configStore';
import { embeddingFingerprint } from './contract';
import { EmbeddingError } from './errors';

// Preview is read-only: the actual save still validates the provider and
// decides whether the retained generation can serve the new configuration.
export async function getAiConfigurationImpact(incoming: Partial<AiConfig>) {
  if (!incoming || typeof incoming !== 'object')
    throw new EmbeddingError('embedding_config_invalid', 400);
  const { config, state } = await readAiSnapshot();
  if (incoming.revision !== state.revision)
    throw new EmbeddingError('embedding_revision_conflict', 409);
  const next = parseIncomingAiConfig(incoming, config);
  const embeddingChanged = embeddingFingerprint(next) !== embeddingFingerprint(config);
  const enabling = next.enabled && next.vectorEnabled && !(config.enabled && config.vectorEnabled);
  return {
    revision: state.revision,
    requiresConfirmation: embeddingChanged || (enabling && state.status !== 'ready'),
  };
}
