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
  return {
    stored,
    removed,
    values: {
      assertSafeOutboundUrl: async () => {},
      fetcher: async (url: string | URL | Request) =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': contentTypes.get(String(url)) ?? 'image/png',
            'content-length': '3',
          },
        }),
      finalizeAttachmentUploads: async () => [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          url: 'https://cdn.example/image.png',
          compressUrl: '',
          posterUrl: '',
          storage: 'R2',
          details: { key: stored[0], mimetype: 'image/png', mediaKind: 'image' },
        },
      ],
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
});
