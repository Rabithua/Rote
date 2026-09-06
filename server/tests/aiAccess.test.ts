import { describe, expect, it } from 'bun:test';
import {
  AI_CHAT_PERMISSION_REQUIRED_MESSAGE,
  AI_MEMORY_UNAVAILABLE_MESSAGE,
  getAiAccessErrorFromAccess,
  isAiMemoryAvailableForAccess,
} from '../authz/aiAccess';
import type { AiConfig } from '../types/config';

const readyConfig: AiConfig = {
  enabled: true,
  vectorEnabled: true,
  autoIndexEnabled: true,
  publicExploreVectorEnabled: false,
  chat: { providerId: 'test', baseUrl: 'http://test', model: 'test-chat' },
  embedding: {
    providerId: 'test',
    baseUrl: 'http://test',
    model: 'test-embedding',
    output: { mode: 'dimensions', output: { mode: 'dimensions', dimensions: 3 } },
  },
  indexing: { chunkSize: 800, chunkOverlap: 100, batchSize: 10, maxRetries: 1 },
};

const vectorReady = {
  available: true,
  installed: true,
  version: '0.8.0',
  indexName: 'document_embeddings_embedding_hnsw_3_idx',
  ready: true,
  dimensions: 3,
};

describe('AI access', () => {
  it('uses AI chat capability without requiring account certification', () => {
    const uncertifiedAccess = { chatAllowed: true, certified: false };
    const deniedCertifiedAccess = { chatAllowed: false, certified: true };

    expect(getAiAccessErrorFromAccess(uncertifiedAccess)).toBe(null);
    expect(getAiAccessErrorFromAccess(deniedCertifiedAccess)).toBe(
      AI_CHAT_PERMISSION_REQUIRED_MESSAGE
    );
  });

  it('makes memory available only when chat permission and runtime are ready', () => {
    expect(
      isAiMemoryAvailableForAccess({
        access: { chatAllowed: true },
        config: readyConfig,
        vectorStatus: vectorReady,
      })
    ).toBe(true);

    expect(
      isAiMemoryAvailableForAccess({
        access: { chatAllowed: false },
        config: readyConfig,
        vectorStatus: vectorReady,
      })
    ).toBe(false);

    expect(
      isAiMemoryAvailableForAccess({
        access: { chatAllowed: true },
        config: { ...readyConfig, vectorEnabled: false },
        vectorStatus: vectorReady,
      })
    ).toBe(false);
  });

  it('keeps the memory unavailable message separate from permission errors', () => {
    expect(AI_MEMORY_UNAVAILABLE_MESSAGE).toBe('Memory tools are not ready');
  });
});
