import { describe, expect, test } from 'bun:test';
import { parseImportPayload } from './importSchema';
import {
  migrateRemoteAttachments,
  REMOTE_ATTACHMENT_MIGRATION_FAILED,
} from './remoteAttachmentService';

const userId = 'user-1';
const storage = {
  endpoint: 'https://storage.example.com',
  bucket: 'rote',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  urlPrefix: 'https://cdn.rote.example',
};
const policy = {
  attachmentsEnabled: true,
  canUploadAttachments: true,
  canUploadVideo: true,
  maxVideoUploadSizeMB: 10,
};

function payloadWithUrls(urls: string[]) {
  return parseImportPayload({
    formatVersion: 2,
    notes: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        content: 'note',
        attachments: urls.map((url, index) => ({
          url,
          storage: 'remote',
          details: { originalname: `image-${index}.png` },
        })),
      },
    ],
  });
}

describe('remote attachment migration', () => {
  test('downloads selected remote attachments into current storage', async () => {
    const stored: Array<{ body: Uint8Array; contentType: string; key: string }> = [];
    const payload = await migrateRemoteAttachments(
      userId,
      payloadWithUrls(['https://source.example/image.png']),
      new Set([0]),
      {
        assertSafeOutboundUrl: async () => {},
        fetcher: async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'image/png' },
          }),
        getAttachmentUploadPolicy: async () => policy,
        randomUUID: () => 'asset-id',
        requireStorageAvailable: () => storage,
        storeObject: async (key, body, contentType) => {
          stored.push({ body, contentType, key });
          return { url: `${storage.urlPrefix}/${key}` };
        },
      }
    );

    const attachment = payload.notes[0].attachments?.[0];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      contentType: 'image/png',
      key: 'users/user-1/uploads/asset-id.png',
    });
    expect([...stored[0].body]).toEqual([1, 2, 3]);
    expect(attachment?.url).toBe('https://cdn.rote.example/users/user-1/uploads/asset-id.png');
    expect(attachment?.compressUrl).toBe(attachment?.url);
    expect(attachment?.storage).toBe('R2');
    expect(attachment?.details).toMatchObject({
      key: 'users/user-1/uploads/asset-id.png',
      mediaKind: 'image',
      mimetype: 'image/png',
      size: 3,
    });
  });

  test('does not download unselected notes or current-storage URLs', async () => {
    let fetchCount = 0;
    const dependencies = {
      assertSafeOutboundUrl: async () => {},
      fetcher: async () => {
        fetchCount += 1;
        return new Response(new Uint8Array([1]), {
          headers: { 'content-type': 'image/png' },
        });
      },
      getAttachmentUploadPolicy: async () => policy,
      requireStorageAvailable: () => storage,
      storeObject: async () => ({ url: '' }),
    };

    await migrateRemoteAttachments(
      userId,
      payloadWithUrls(['https://source.example/skipped.png']),
      new Set(),
      dependencies
    );
    await migrateRemoteAttachments(
      userId,
      payloadWithUrls(['https://cdn.rote.example/users/user-1/uploads/current.png']),
      new Set([0]),
      dependencies
    );

    expect(fetchCount).toBe(0);
  });

  test('validates redirect destinations and hides download failure details', async () => {
    const validated: string[] = [];
    let fetchCount = 0;

    await expect(
      migrateRemoteAttachments(
        userId,
        payloadWithUrls(['https://source.example/image.png']),
        new Set([0]),
        {
          assertSafeOutboundUrl: async (url) => {
            validated.push(url);
            if (url.includes('127.0.0.1')) throw new Error('private address');
          },
          fetcher: async () => {
            fetchCount += 1;
            return new Response(null, {
              status: 302,
              headers: { location: 'http://127.0.0.1/private.png' },
            });
          },
          getAttachmentUploadPolicy: async () => policy,
          requireStorageAvailable: () => storage,
          storeObject: async () => ({ url: '' }),
        }
      )
    ).rejects.toThrow(REMOTE_ATTACHMENT_MIGRATION_FAILED);

    expect(fetchCount).toBe(1);
    expect(validated).toEqual(['https://source.example/image.png', 'http://127.0.0.1/private.png']);
  });

  test('rejects migration when storage has no public URL prefix', async () => {
    await expect(
      migrateRemoteAttachments(
        userId,
        payloadWithUrls(['https://source.example/image.png']),
        new Set([0]),
        {
          requireStorageAvailable: () => ({ ...storage, urlPrefix: '' }),
        }
      )
    ).rejects.toThrow(REMOTE_ATTACHMENT_MIGRATION_FAILED);
  });
});
