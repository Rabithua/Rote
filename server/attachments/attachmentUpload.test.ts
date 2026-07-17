import { describe, expect, it } from 'bun:test';
import type { UploadResult } from '../types/main';
import { presignPutUrlForConfig } from '../utils/r2';
import { presignAttachmentUploads } from './presignUpload';
import { getUploadExtension } from './uploadKeys';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { finalizeAttachmentUploads } = await import('./finalizeUpload');

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LIVE_UUID = '11111111-1111-4111-8111-111111111111';
const URL_PREFIX = 'https://cdn.example.com';

const storageConfig = {
  accessKeyId: 'test',
  bucket: 'test',
  endpoint: 'https://storage.example.com',
  secretAccessKey: 'test',
  urlPrefix: URL_PREFIX,
};

const uploadPolicy = {
  attachmentsEnabled: true,
  canUploadAttachments: true,
  canUploadVideo: true,
  maxVideoUploadSizeMB: 300,
};

describe('attachment upload flow', () => {
  it('uses the signed Content-Type to choose the key extension', () => {
    expect(getUploadExtension('photo.webp', 'image/jpeg')).toBe('.jpg');
    expect(getUploadExtension('photo.jpg', 'image/webp')).toBe('.webp');
    expect(getUploadExtension('IMG_0001.HEIC', 'image/heic; charset=binary')).toBe('.heic');
  });

  it('binds the upload Content-Type into the presigned PUT signature', async () => {
    const { putUrl } = await presignPutUrlForConfig(
      storageConfig,
      `users/${USER_ID}/compressed/${LIVE_UUID}.jpg`,
      'image/jpeg'
    );

    expect(new URL(putUrl).searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
  });

  it('does not presign a client WebP target for Live Photos', async () => {
    const signed: Array<{ contentType?: string; key: string }> = [];
    const result = await presignAttachmentUploads(
      {
        files: [
          {
            contentType: 'image/heic',
            filename: 'IMG_0001.HEIC',
            mediaKind: 'livePhoto',
            pairedVideo: {
              contentType: 'video/quicktime',
              filename: 'IMG_0001.MOV',
              size: 2048,
            },
            size: 1024,
          },
        ],
        scopes: ['video:upload'],
        userId: USER_ID,
      },
      {
        getAttachmentUploadPolicy: async () => uploadPolicy,
        presignPutUrl: async (key, contentType) => {
          signed.push({ contentType, key });
          return { putUrl: `https://put.example.com/${key}`, url: `${URL_PREFIX}/${key}` };
        },
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.items[0].compressed).toBeUndefined();
    expect(result.items[0].original.key).toEndWith('.heic');
    expect(result.items[0].original.contentType).toBe('image/heic');
    expect(result.items[0].pairedVideo.key).toEndWith('.mov');
    expect(result.items[0].pairedVideo.contentType).toBe('video/quicktime');
    expect(signed.some(({ key }) => key.endsWith('.webp'))).toBe(false);
  });

  it('finalizes HEIC and MOV with a browser-compatible cover URL', async () => {
    const originalKey = `users/${USER_ID}/uploads/${LIVE_UUID}.heic`;
    const pairedVideoKey = `users/${USER_ID}/paired-videos/${LIVE_UUID}.mov`;
    const coverKey = `users/${USER_ID}/compressed/${LIVE_UUID}.jpg`;
    let persisted: UploadResult[] = [];

    const result = await finalizeAttachmentUploads(
      {
        attachments: [
          {
            mimetype: 'image/heic',
            mediaKind: 'livePhoto',
            originalKey,
            pairedVideoKey,
            pairedVideoMimetype: 'video/quicktime',
            pairedVideoSize: 2048,
            size: 1024,
            uuid: LIVE_UUID,
          },
        ],
        scopes: ['video:upload'],
        userId: USER_ID,
      },
      {
        checkObjectExists: async (key) => key === originalKey || key === pairedVideoKey,
        ensureLivePhotoCover: async () => ({
          contentType: 'image/jpeg',
          key: coverKey,
          size: 512,
          status: 'generated',
        }),
        getAttachmentUploadPolicy: async () => uploadPolicy,
        requireStorageAvailable: () => storageConfig,
        upsertAttachmentsByOriginalKey: async (_userId, _noteId, uploads) => {
          persisted = uploads;
          return uploads.map((upload, index) => ({ id: `attachment-${index}`, ...upload }));
        },
      }
    );

    expect(persisted[0].url).toBe(`${URL_PREFIX}/${originalKey}`);
    expect(persisted[0].compressUrl).toBe(`${URL_PREFIX}/${coverKey}`);
    expect(persisted[0].posterUrl).toBeNull();
    expect(persisted[0].details.compressKey).toBe(coverKey);
    expect(persisted[0].details.pairedVideoKey).toBe(pairedVideoKey);
    expect(persisted[0].details.pairedVideoUrl).toBe(`${URL_PREFIX}/${pairedVideoKey}`);
    expect(result[0].compressUrl).toBe(`${URL_PREFIX}/${coverKey}`);
  });

  it('preserves JPEG, PNG, GIF, and video attachment behavior', async () => {
    const inputs = [
      {
        compressedKey: `users/${USER_ID}/compressed/jpeg.webp`,
        mimetype: 'image/jpeg',
        originalKey: `users/${USER_ID}/uploads/jpeg.jpg`,
        size: 100,
        uuid: 'jpeg',
      },
      {
        mimetype: 'image/png',
        originalKey: `users/${USER_ID}/uploads/png.png`,
        size: 100,
        uuid: 'png',
      },
      {
        mimetype: 'image/gif',
        originalKey: `users/${USER_ID}/uploads/gif.gif`,
        size: 100,
        uuid: 'gif',
      },
      {
        mimetype: 'video/mp4',
        originalKey: `users/${USER_ID}/uploads/video.mp4`,
        posterKey: `users/${USER_ID}/posters/video.jpg`,
        size: 100,
        uuid: 'video',
      },
    ];
    let persisted: UploadResult[] = [];
    await finalizeAttachmentUploads(
      { attachments: inputs, scopes: ['video:upload'], userId: USER_ID },
      {
        checkObjectExists: async () => true,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        requireStorageAvailable: () => storageConfig,
        upsertAttachmentsByOriginalKey: async (_userId, _noteId, uploads) => {
          persisted = uploads;
          return uploads;
        },
      }
    );

    expect(persisted.map(({ details }) => details.mediaKind)).toEqual([
      'image',
      'image',
      'image',
      'video',
    ]);
    expect(persisted[0].compressUrl).toEndWith('/compressed/jpeg.webp');
    expect(persisted[1].url).toEndWith('/uploads/png.png');
    expect(persisted[2].url).toEndWith('/uploads/gif.gif');
    expect(persisted[3].posterUrl).toEndWith('/posters/video.jpg');
  });
});
