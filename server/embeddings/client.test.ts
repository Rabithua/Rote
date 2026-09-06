import { afterEach, describe, expect, it } from 'bun:test';
import type { EmbeddingProviderConfig } from '../types/config';
import { createEmbedding, testEmbeddingProvider } from './client';
import { validateVector, embeddingFingerprint } from './contract';
import { DEFAULT_AI_CONFIG } from '../utils/ai/providers';

const originalFetch = globalThis.fetch;
const provider: EmbeddingProviderConfig = {
  providerId: 'siliconflow',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'BAAI/bge-m3',
  output: { mode: 'native' },
};
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function respond(dimensions: number, inspect?: (body: Record<string, unknown>) => void) {
  globalThis.fetch = (async (_url, init) => {
    inspect?.(JSON.parse(String(init?.body)));
    return Response.json({ data: [{ embedding: Array(dimensions).fill(0.1) }] });
  }) as typeof fetch;
}
describe('embedding request contract', () => {
  it('uses BGE-M3 native dimensions without sending dimensions', async () => {
    respond(1024, (body) =>
      expect(body).toEqual({ model: 'BAAI/bge-m3', input: 'Rote embedding connectivity test.' })
    );
    expect(await testEmbeddingProvider(provider)).toEqual({
      dimensions: 1024,
      output: { mode: 'native' },
    });
  });
  it('validates the protocol over a controllable HTTP model server', async () => {
    const service = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const body = await request.json();
        if ('dimensions' in body) return Response.json({ error: 'unsupported' }, { status: 400 });
        return Response.json({ data: [{ embedding: Array(1024).fill(0.1) }] });
      },
    });
    try {
      const config = { ...provider, baseUrl: `http://127.0.0.1:${service.port}/v1` };
      expect((await testEmbeddingProvider(config)).dimensions).toBe(1024);
      await expect(
        testEmbeddingProvider({ ...config, output: { mode: 'dimensions', dimensions: 1024 } })
      ).rejects.toMatchObject({ code: 'embedding_parameter_rejected' });
    } finally {
      service.stop(true);
    }
  });
  it('accepts unlisted models using the native protocol', async () => {
    respond(17);
    expect(
      (await createEmbedding({ ...provider, model: 'new-model' }, 'test')).embedding
    ).toHaveLength(17);
  });
  it('sends an explicitly requested dimension and detects ignored parameters', async () => {
    const config: EmbeddingProviderConfig = {
      ...provider,
      output: { mode: 'dimensions', dimensions: 3 },
    };
    respond(3, (body) => expect(body.dimensions).toBe(3));
    expect((await testEmbeddingProvider(config)).dimensions).toBe(3);
    respond(1024);
    await expect(testEmbeddingProvider(config)).rejects.toMatchObject({
      code: 'embedding_dimensions_mismatch',
      details: { expected: 3, actual: 1024 },
    });
  });
  it('accepts 2000 dimensions and rejects 2001 with actionable details', async () => {
    respond(2000);
    expect((await testEmbeddingProvider(provider)).dimensions).toBe(2000);
    respond(2001);
    await expect(testEmbeddingProvider(provider)).rejects.toMatchObject({
      code: 'embedding_dimensions_limit',
      details: { actual: 2001, limit: 2000 },
    });
  });
  it('validates the persisted native dimension on every runtime request', async () => {
    respond(3);
    await expect(
      createEmbedding(provider, 'text', { expectedDimensions: 4 })
    ).rejects.toMatchObject({ code: 'embedding_dimensions_mismatch' });
  });
  it('rejects invalid or unusable float32 vectors', () => {
    for (const value of [[], [0, 0], [NaN], [Infinity], [1e100], [1e-100], ['1'], null]) {
      expect(() => validateVector(value)).toThrow('embedding_response_invalid');
    }
    expect(validateVector([0.1, -0.2])).toEqual([0.1, -0.2]);
  });
  it('does not retry rejected parameters or expose provider payloads', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json({ message: 'private detail' }, { status: 400 });
    }) as typeof fetch;
    await expect(testEmbeddingProvider(provider)).rejects.toMatchObject({
      code: 'embedding_parameter_rejected',
      retryable: false,
      details: { providerStatus: 400 },
    });
    expect(calls).toBe(1);
  });
  it('classifies transient failures and times out stalled requests', async () => {
    globalThis.fetch = (async () => new Response('', { status: 429 })) as typeof fetch;
    await expect(testEmbeddingProvider(provider)).rejects.toMatchObject({
      code: 'embedding_rate_limited',
      retryable: true,
    });
    globalThis.fetch = ((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;
    await expect(createEmbedding(provider, 'test', { timeoutMs: 5 })).rejects.toMatchObject({
      code: 'embedding_timeout',
      retryable: true,
    });
  });
  it('fingerprints semantic configuration while allowing credential rotation', () => {
    const config = structuredClone(DEFAULT_AI_CONFIG);
    const before = embeddingFingerprint(config);
    config.embedding.apiKey = 'rotated';
    config.indexing.paused = true;
    expect(embeddingFingerprint(config)).toBe(before);
    config.embedding.baseUrl = 'https://another-provider.test/v1';
    expect(embeddingFingerprint(config)).not.toBe(before);
  });
});
