import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { createEmbedding } from './client';
import * as usageRepository from '../aiUsage/repository';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const provider = {
  providerId: 'test',
  baseUrl: 'http://test',
  model: 'embedding',
  output: { mode: 'native' as const },
};

describe('interactive embedding cancellation', () => {
  it('never dispatches an already cancelled query', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    controller.abort(reason);
    let requests = 0;
    const save = spyOn(usageRepository, 'saveAiUsage').mockResolvedValue(undefined);
    globalThis.fetch = (async () => {
      requests++;
      return Response.json({});
    }) as typeof fetch;
    try {
      await expect(createEmbedding(provider, 'query', { signal: controller.signal })).rejects.toBe(
        reason
      );
      expect(requests).toBe(0);
      expect(save).not.toHaveBeenCalled();
    } finally {
      save.mockRestore();
    }
  });

  it('closes the real HTTP request and records cancellation rather than a timeout', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    let queryStarted!: () => void;
    let queryAborted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      queryStarted = resolve;
    });
    const aborted = new Promise<void>((resolve) => {
      queryAborted = resolve;
    });
    const service = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        request.signal.addEventListener('abort', queryAborted, { once: true });
        await new Promise<void>((resolve) => {
          release = resolve;
          queryStarted();
        });
        return Response.json({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
      },
    });
    const save = spyOn(usageRepository, 'saveAiUsage').mockResolvedValue(undefined);
    try {
      const pending = createEmbedding(
        { ...provider, baseUrl: `http://127.0.0.1:${service.port}` },
        'query',
        {
          signal: controller.signal,
          usageContext: { userId: 'owner', purpose: 'embedding_query' },
        }
      );
      await started;
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      await aborted;
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0]?.[0]).toMatchObject({
        status: 'cancelled',
        usageStatus: 'unknown',
        userid: 'owner',
        purpose: 'embedding_query',
      });
    } finally {
      release?.();
      service.stop(true);
      save.mockRestore();
    }
  });

  it('also aborts while reading the response body', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Stopped', 'AbortError');
    let reading!: () => void;
    const started = new Promise<void>((resolve) => {
      reading = resolve;
    });
    globalThis.fetch = (async (_url, init) =>
      new Response(
        new ReadableStream({
          start(body) {
            init?.signal?.addEventListener('abort', () => body.error(init.signal?.reason), {
              once: true,
            });
            reading();
          },
        })
      )) as typeof fetch;
    const save = spyOn(usageRepository, 'saveAiUsage').mockResolvedValue(undefined);
    try {
      const pending = createEmbedding(provider, 'query', { signal: controller.signal });
      await started;
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      expect(save.mock.calls[0]?.[0]).toMatchObject({ status: 'cancelled' });
    } finally {
      save.mockRestore();
    }
  });
});
