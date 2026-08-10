import { describe, expect, test } from 'bun:test';
import type { Readable } from 'node:stream';
import {
  createRemoteAttachmentLimiter,
  migrateOneRemoteAttachment,
  RemoteAttachmentMigrationError,
} from './remoteAttachmentMigrationService';

const policy = {
  attachmentsEnabled: true,
  canUploadAttachments: true,
  canUploadVideo: true,
  maxVideoUploadSizeMB: 10,
};

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://source.example/image.png',
    compressUrl: '',
    posterUrl: '',
    storage: 'REMOTE',
    details: { originalname: 'image.png', mimetype: 'image/png' },
    ...overrides,
  };
}

function dependencies(contentTypes = new Map<string, string>()) {
  const stored: string[] = [];
  const removed: string[] = [];
  const finalizedInputs: unknown[] = [];
  return {
    stored,
    removed,
    finalizedInputs,
    values: {
      assertSafeOutboundUrl: async () => {},
      fetcher: async (url: string | URL | Request) =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': contentTypes.get(String(url)) ?? 'image/png',
            'content-length': '3',
          },
        }),
      finalizeAttachmentUploads: async (input: unknown) => {
        finalizedInputs.push(input);
        return [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            url: 'https://cdn.example/image.png',
            compressUrl: '',
            posterUrl: '',
            storage: 'R2',
            details: { key: stored[0], mimetype: 'image/png', mediaKind: 'image' },
          },
        ];
      },
      getAttachmentUploadPolicy: async () => policy,
      randomUUID: () => 'asset-id',
      removeObject: async (key: string) => {
        removed.push(key);
        return true;
      },
      requireStorageAvailable: () => ({
        endpoint: 'https://storage.example',
        bucket: 'bucket',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        urlPrefix: 'https://cdn.example',
      }),
      storeObjectStream: async (key: string, body: Readable) => {
        for await (const _chunk of body) {
          // Drain the stream to exercise byte counting.
        }
        stored.push(key);
        return { url: `https://cdn.example/${key}` };
      },
    },
  };
}

describe('single remote attachment migration', () => {
  test('streams and finalizes an image as an unbound attachment', async () => {
    const deps = dependencies();
    const result = await migrateOneRemoteAttachment('user-1', attachment(), deps.values as never);

    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(deps.stored).toEqual(['users/user-1/uploads/asset-id.png']);
    expect(deps.removed).toEqual([]);
  });

  test('sends source authorization only to the configured Memos origin', async () => {
    const deps = dependencies();
    const seen: Array<{ url: string; authorization?: string }> = [];
    deps.values.fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({ url: String(url), authorization: headers.get('authorization') ?? undefined });
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      });
    };

    await migrateOneRemoteAttachment('user-1', attachment(), deps.values as never, {
      auth: { baseUrl: 'https://source.example', bearerToken: 'private-token' },
    });
    expect(seen).toEqual([
      { url: 'https://source.example/image.png', authorization: 'Bearer private-token' },
    ]);

    seen.length = 0;
    await migrateOneRemoteAttachment(
      'user-1',
      attachment({ url: 'https://cdn.example/image.png' }),
      deps.values as never,
      { auth: { baseUrl: 'https://source.example', bearerToken: 'private-token' } }
    );
    expect(seen).toEqual([{ url: 'https://cdn.example/image.png', authorization: undefined }]);
  });

  test('rejects an image used as a Live Photo paired video and cleans the original', async () => {
    const pairedUrl = 'https://source.example/paired.jpg';
    const deps = dependencies(new Map([[pairedUrl, 'image/jpeg']]));

    await expect(
      migrateOneRemoteAttachment(
        'user-1',
        attachment({ details: { ...attachment().details, pairedVideoUrl: pairedUrl } }),
        deps.values as never
      )
    ).rejects.toMatchObject<RemoteAttachmentMigrationError>({
      code: 'remote_attachment_invalid',
    });
    expect(deps.removed).toEqual(['users/user-1/uploads/asset-id.png']);
  });

  test('does not upload a compressed still that Live Photo finalization discards', async () => {
    const compressedUrl = 'https://source.example/image.webp';
    const pairedVideoUrl = 'https://source.example/image.mov';
    const deps = dependencies(
      new Map([
        [compressedUrl, 'image/webp'],
        [pairedVideoUrl, 'video/quicktime'],
      ])
    );

    await migrateOneRemoteAttachment(
      'user-1',
      attachment({
        compressUrl: compressedUrl,
        details: {
          ...attachment().details,
          pairedVideoUrl,
          pairedVideoFilename: 'image.mov',
          pairedVideoMimetype: 'video/quicktime',
        },
      }),
      deps.values as never
    );

    expect(deps.stored).toEqual([
      'users/user-1/uploads/asset-id.png',
      'users/user-1/paired-videos/asset-id.mov',
    ]);
    expect(deps.finalizedInputs).toEqual([
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            compressedKey: undefined,
            mediaKind: 'livePhoto',
            pairedVideoKey: 'users/user-1/paired-videos/asset-id.mov',
          }),
        ],
      }),
    ]);
  });

  test('preserves the streamed too-large error instead of reporting a storage outage', async () => {
    const deps = dependencies();
    deps.values.fetcher = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1));
            controller.close();
          },
        }),
        { headers: { 'content-type': 'image/png' } }
      );

    await expect(
      migrateOneRemoteAttachment('user-1', attachment(), deps.values as never)
    ).rejects.toMatchObject<RemoteAttachmentMigrationError>({
      code: 'remote_attachment_too_large',
      status: 413,
    });
  });

  test('limits concurrent work and refills the queue', async () => {
    const limiter = createRemoteAttachmentLimiter(3, 20);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        limiter(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await Promise.resolve();
          order.push(index);
          active -= 1;
        })
      )
    );
    expect(peak).toBe(3);
    expect(order).toHaveLength(12);
  });

  test('removes aborted work from the queue and immediately admits the next task', async () => {
    const limiter = createRemoteAttachmentLimiter(1, 20);
    let releaseFirst!: () => void;
    const first = limiter(() => new Promise<void>((resolve) => (releaseFirst = resolve)));
    const controller = new AbortController();
    const canceled = limiter(async () => {}, controller.signal);
    const order: string[] = [];
    const next = limiter(async () => {
      order.push('next');
    });

    controller.abort();
    await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    releaseFirst();
    await Promise.all([first, next]);

    expect(order).toEqual(['next']);
  });
});
