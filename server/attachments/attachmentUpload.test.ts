import { describe, expect, it } from 'bun:test';
import type { UploadResult } from '../types/main';
import { presignPutUrlForConfig } from '../utils/r2';
import { presignAttachmentUploads } from './presignUpload';
import { getUploadExtension } from './uploadKeys';

process.env.POSTGRESQL_URL ||= 'postgres://test:test@localhost:5432/rote_test';
const { assertCompleteRequiredManifest, completedLegacyFinalizeResult, finalizeAttachmentUploads } =
  await import('./finalizeUpload');

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
  it('rejects batch-shaped completion results on the legacy finalize path', () => {
    expect(() =>
      completedLegacyFinalizeResult({
        attachments: [],
        batchId: LIVE_UUID,
        clientIdMap: {},
        orderedAttachmentIds: [],
      })
    ).toThrow('resource_upload_manifest_mismatch');
  });

  it('keeps legacy derivatives optional but requires every batch manifest part', () => {
    const reservationId = LIVE_UUID;
    const original = `users/${USER_ID}/staging/${reservationId}/uploads/a.jpg`;
    const compressed = `users/${USER_ID}/staging/${reservationId}/compressed/a.webp`;
    const liveOriginal = `users/${USER_ID}/staging/${reservationId}/uploads/b.heic`;
    const paired = `users/${USER_ID}/staging/${reservationId}/paired-videos/b.mov`;
    const manifest = [
      {
        uuid: 'a',
        role: 'original' as const,
        stagingKey: original,
        finalKey: 'a',
        declaredBytes: '1',
        contentType: 'image/jpeg',
        billable: true,
      },
      {
        uuid: 'a',
        role: 'compressed' as const,
        stagingKey: compressed,
        finalKey: 'ac',
        declaredBytes: null,
        contentType: 'image/webp',
        billable: false,
      },
      {
        uuid: 'b',
        role: 'original' as const,
        stagingKey: liveOriginal,
        finalKey: 'b',
        declaredBytes: '1',
        contentType: 'image/heic',
        billable: true,
      },
      {
        uuid: 'b',
        role: 'paired_video' as const,
        stagingKey: paired,
        finalKey: 'bp',
        declaredBytes: '1',
        contentType: 'video/quicktime',
        billable: true,
      },
    ];
    expect(() =>
      assertCompleteRequiredManifest(
        [
          { uuid: 'a', originalKey: original },
          { uuid: 'b', originalKey: liveOriginal, pairedVideoKey: paired },
        ],
        manifest
      )
    ).not.toThrow();
    expect(() =>
      assertCompleteRequiredManifest(
        [
          { uuid: 'a', originalKey: original },
          { uuid: 'b', originalKey: liveOriginal, pairedVideoKey: paired },
        ],
        manifest,
        true
      )
    ).toThrow();
    expect(() =>
      assertCompleteRequiredManifest([{ uuid: 'a', originalKey: original }], manifest)
    ).toThrow();
    expect(() =>
      assertCompleteRequiredManifest(
        [
          { uuid: 'a', originalKey: original },
          { uuid: 'b', originalKey: liveOriginal },
        ],
        manifest
      )
    ).toThrow();
  });
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

  it('presigns a client JPEG preview target for Live Photos', async () => {
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
        getResourceStateForUserId: async () => ({
          management: 'unmanaged',
          source: 'unmanaged',
          storage: {
            enforcement: 'off',
            usedBytes: null,
            reservedBytes: null,
            limitBytes: null,
            overLimit: null,
            canUpload: true,
          },
          openKey: {
            policy: 'unmanaged',
            creationThreshold: null,
            existingCount: 0,
            canCreate: true,
          },
        }),
        createUploadReservation: async () => false,
        presignPutUrl: async (key, contentType) => {
          signed.push({ contentType, key });
          return { putUrl: `https://put.example.com/${key}`, url: `${URL_PREFIX}/${key}` };
        },
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.items[0].compressed.key).toEndWith('.jpg');
    expect(result.items[0].compressed.contentType).toBe('image/jpeg');
    expect(result.items[0].original.key).toEndWith('.heic');
    expect(result.items[0].original.contentType).toBe('image/heic');
    expect(result.items[0].pairedVideo.key).toEndWith('.mov');
    expect(result.items[0].pairedVideo.contentType).toBe('video/quicktime');
    expect(
      signed.some(({ contentType, key }) => contentType === 'image/jpeg' && key.endsWith('.jpg'))
    ).toBe(true);
  });

  it('honors an iOS JPEG preview preference for standalone images', async () => {
    const result = await presignAttachmentUploads(
      {
        files: [
          {
            compressedContentType: 'image/jpeg',
            contentType: 'image/heic',
            filename: 'IMG_0002.HEIC',
            mediaKind: 'image',
            size: 1024,
          },
        ],
        scopes: [],
        userId: USER_ID,
      },
      {
        createUploadReservation: async () => false,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        getResourceStateForUserId: async () => ({
          management: 'unmanaged',
          source: 'unmanaged',
          storage: {
            enforcement: 'off',
            usedBytes: null,
            reservedBytes: null,
            limitBytes: null,
            overLimit: null,
            canUpload: true,
          },
          openKey: {
            policy: 'unmanaged',
            creationThreshold: null,
            existingCount: 0,
            canCreate: true,
          },
        }),
        presignPutUrl: async (key) => ({
          putUrl: `https://put.example.com/${key}`,
          url: `${URL_PREFIX}/${key}`,
        }),
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.items[0].compressed.key).toEndWith('.jpg');
    expect(result.items[0].compressed.contentType).toBe('image/jpeg');
  });

  it('uses length-bound staging objects and one atomic reservation for managed uploads', async () => {
    const signed: Array<{ contentLength?: number; key: string }> = [];
    let reservation:
      | Parameters<
          NonNullable<Parameters<typeof presignAttachmentUploads>[1]['createUploadReservation']>
        >[0]
      | undefined;
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
        createDerivedUploadProxyUrl: ({ key }) => `https://put.example.com/${key}`,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        getResourceStateForUserId: async () => ({
          management: 'official',
          source: 'official_pro',
          storage: {
            enforcement: 'enforce',
            usedBytes: '0',
            reservedBytes: '0',
            limitBytes: '10000000000',
            overLimit: false,
            canUpload: true,
          },
          openKey: {
            policy: 'unlimited',
            creationThreshold: null,
            existingCount: 2,
            canCreate: true,
          },
        }),
        createUploadReservation: async (input) => {
          reservation = input;
          return true;
        },
        presignPutUrl: async (key, _contentType, _expiresIn, contentLength) => {
          signed.push({ contentLength, key });
          return { putUrl: `https://put.example.com/${key}`, url: `${URL_PREFIX}/${key}` };
        },
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.reservationId).toBe(LIVE_UUID);
    const remainingReservationLifetime = reservation!.expiresAt.getTime() - Date.now();
    expect(remainingReservationLifetime).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(remainingReservationLifetime).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(result.items[0].original.key).toContain(`/staging/${LIVE_UUID}/`);
    expect(result.items[0].pairedVideo.key).toContain(`/staging/${LIVE_UUID}/`);
    expect(signed.map(({ contentLength }) => contentLength)).toEqual([1024, 2048]);
    expect(reservation?.manifest.map(({ role, declaredBytes }) => [role, declaredBytes])).toEqual([
      ['original', '1024'],
      ['compressed', null],
      ['paired_video', '2048'],
    ]);
  });

  it('presigns the final attachment key without a preview for direct uploads', async () => {
    const signed: Array<{ contentLength?: number; key: string }> = [];
    let reservation:
      | Parameters<
          NonNullable<Parameters<typeof presignAttachmentUploads>[1]['createUploadReservation']>
        >[0]
      | undefined;
    const result = await presignAttachmentUploads(
      {
        directFinalUpload: true,
        files: [
          {
            contentType: 'image/jpeg',
            filename: 'IMG_0002.JPG',
            mediaKind: 'image',
            size: 1024,
          },
        ],
        scopes: [],
        userId: USER_ID,
      },
      {
        createUploadReservation: async (input) => {
          reservation = input;
          return true;
        },
        getAttachmentUploadPolicy: async () => uploadPolicy,
        getResourceStateForUserId: async () => ({
          management: 'official',
          source: 'official_pro',
          storage: {
            enforcement: 'enforce',
            usedBytes: '0',
            reservedBytes: '0',
            limitBytes: '10000000000',
            overLimit: false,
            canUpload: true,
          },
          openKey: {
            policy: 'unlimited',
            creationThreshold: null,
            existingCount: 2,
            canCreate: true,
          },
        }),
        presignPutUrl: async (key, _contentType, _expiresIn, contentLength) => {
          signed.push({ contentLength, key });
          return { putUrl: `https://put.example.com/${key}`, url: `${URL_PREFIX}/${key}` };
        },
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.items[0].original.key).toBe(
      `users/${USER_ID}/attachments/${LIVE_UUID}/original.jpg`
    );
    expect(result.items[0].compressed).toBeUndefined();
    expect(reservation?.manifest).toHaveLength(1);
    expect(reservation?.manifest[0].stagingKey).toBe(reservation?.manifest[0].finalKey);
    expect(signed).toEqual([
      {
        contentLength: 1024,
        key: `users/${USER_ID}/attachments/${LIVE_UUID}/original.jpg`,
      },
    ]);
  });

  it('presigns a direct video and its client-generated poster at final keys', async () => {
    const signed: Array<{ contentLength?: number; key: string }> = [];
    let reservation:
      | Parameters<
          NonNullable<Parameters<typeof presignAttachmentUploads>[1]['createUploadReservation']>
        >[0]
      | undefined;
    const result = await presignAttachmentUploads(
      {
        directFinalUpload: true,
        files: [
          {
            contentType: 'video/quicktime',
            filename: 'clip.mov',
            mediaKind: 'video',
            poster: { contentType: 'image/jpeg', size: 256 },
            size: 2048,
          },
        ],
        scopes: ['video:upload'],
        userId: USER_ID,
      },
      {
        createUploadReservation: async (input) => {
          reservation = input;
          return true;
        },
        getAttachmentUploadPolicy: async () => uploadPolicy,
        getResourceStateForUserId: async () => ({
          management: 'official',
          source: 'official_pro',
          storage: {
            enforcement: 'enforce',
            usedBytes: '0',
            reservedBytes: '0',
            limitBytes: '10000000000',
            overLimit: false,
            canUpload: true,
          },
          openKey: {
            policy: 'unlimited',
            creationThreshold: null,
            existingCount: 2,
            canCreate: true,
          },
        }),
        presignPutUrl: async (key, _contentType, _expiresIn, contentLength) => {
          signed.push({ contentLength, key });
          return { putUrl: `https://put.example.com/${key}`, url: `${URL_PREFIX}/${key}` };
        },
        randomUUID: () => LIVE_UUID,
        requireStorageAvailable: () => storageConfig,
      }
    );

    expect(result.items[0].original.key).toBe(
      `users/${USER_ID}/attachments/${LIVE_UUID}/original.mov`
    );
    expect(result.items[0].poster?.key).toBe(
      `users/${USER_ID}/attachments/${LIVE_UUID}/poster.jpg`
    );
    expect(reservation?.manifest.map(({ role, declaredBytes }) => [role, declaredBytes])).toEqual([
      ['original', '2048'],
      ['poster', '256'],
    ]);
    expect(signed).toEqual([
      {
        contentLength: 2048,
        key: `users/${USER_ID}/attachments/${LIVE_UUID}/original.mov`,
      },
      {
        contentLength: 256,
        key: `users/${USER_ID}/attachments/${LIVE_UUID}/poster.jpg`,
      },
    ]);
  });

  it('finalizes a client-provided Live Photo preview without media processing', async () => {
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
            compressedKey: coverKey,
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
        checkObjectExists: async (key) =>
          key === originalKey || key === coverKey || key === pairedVideoKey,
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

  it('does not generate a server-side cover when a legacy HEIC upload omits one', async () => {
    const originalKey = `users/${USER_ID}/uploads/${LIVE_UUID}.heic`;

    const result = await finalizeAttachmentUploads(
      {
        attachments: [
          {
            mimetype: 'image/heic',
            mediaKind: 'image',
            originalKey,
            size: 1024,
            uuid: LIVE_UUID,
          },
        ],
        scopes: [],
        userId: USER_ID,
      },
      {
        checkObjectExists: async (key) => key === originalKey,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        requireStorageAvailable: () => storageConfig,
        upsertAttachmentsByOriginalKey: async (_userId, _noteId, uploads) => uploads,
      }
    );

    expect(result[0].url).toBe(`${URL_PREFIX}/${originalKey}`);
    expect(result[0].compressUrl).toBeNull();
    expect(result[0].details.compressKey).toBeUndefined();
  });

  it('uses the client-declared media metadata without reading image bytes', async () => {
    const originalKey = `users/${USER_ID}/uploads/mislabelled-standalone.jpg`;

    const result = await finalizeAttachmentUploads(
      {
        attachments: [
          {
            mimetype: 'image/jpeg',
            mediaKind: 'image',
            originalKey,
            size: 1024,
            uuid: 'mislabelled-standalone',
          },
        ],
        scopes: [],
        userId: USER_ID,
      },
      {
        checkObjectExists: async (key) => key === originalKey,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        requireStorageAvailable: () => storageConfig,
        upsertAttachmentsByOriginalKey: async (_userId, _noteId, uploads) => uploads,
      }
    );

    expect(result[0].details.mimetype).toBe('image/jpeg');
    expect(result[0].compressUrl).toBeNull();
  });

  it('keeps a client-provided JPEG Live Photo preview', async () => {
    const originalKey = `users/${USER_ID}/uploads/${LIVE_UUID}.jpg`;
    const pairedVideoKey = `users/${USER_ID}/paired-videos/${LIVE_UUID}.mov`;
    const coverKey = `users/${USER_ID}/compressed/${LIVE_UUID}.jpg`;

    const result = await finalizeAttachmentUploads(
      {
        attachments: [
          {
            mimetype: 'image/jpeg',
            mediaKind: 'livePhoto',
            originalKey,
            compressedKey: coverKey,
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
        checkObjectExists: async () => true,
        getAttachmentUploadPolicy: async () => uploadPolicy,
        requireStorageAvailable: () => storageConfig,
        upsertAttachmentsByOriginalKey: async (_userId, _noteId, uploads) => uploads,
      }
    );

    expect(result[0].url).toBe(`${URL_PREFIX}/${originalKey}`);
    expect(result[0].compressUrl).toBe(`${URL_PREFIX}/${coverKey}`);
    expect(result[0].details.compressKey).toBe(coverKey);
    expect(result[0].details.pairedVideoKey).toBe(pairedVideoKey);
  });

  it('validates note attachment limits before persistence', async () => {
    const originalKey = `users/${USER_ID}/uploads/${LIVE_UUID}.heic`;
    const pairedVideoKey = `users/${USER_ID}/paired-videos/${LIVE_UUID}.mov`;
    await expect(
      finalizeAttachmentUploads(
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
          noteId: 'note-at-image-limit',
          scopes: ['video:upload'],
          userId: USER_ID,
        },
        {
          checkObjectExists: async () => true,
          getAttachmentDetailsByRoteId: async () =>
            Array.from({ length: 9 }, (_, index) => ({
              details: {
                key: `users/${USER_ID}/uploads/existing-${index}.jpg`,
                mediaKind: 'image' as const,
                mimetype: 'image/jpeg',
              },
            })),
          getAttachmentUploadPolicy: async () => uploadPolicy,
          requireStorageAvailable: () => storageConfig,
          upsertAttachmentsByOriginalKey: async () => {
            throw new Error('invalid note attachments must not be persisted');
          },
        }
      )
    ).rejects.toThrow('Maximum 9 images');
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

  it('rejects the entire strict batch when one attachment object is missing', async () => {
    const availableKey = `users/${USER_ID}/uploads/available.jpg`;
    const missingKey = `users/${USER_ID}/uploads/missing.jpg`;
    let upsertCalled = false;

    await expect(
      finalizeAttachmentUploads(
        {
          attachments: [
            {
              mimetype: 'image/jpeg',
              originalKey: availableKey,
              size: 16,
              uuid: '11111111-1111-4111-8111-111111111111',
            },
            {
              mimetype: 'image/jpeg',
              originalKey: missingKey,
              size: 16,
              uuid: '22222222-2222-4222-8222-222222222222',
            },
          ],
          scopes: [],
          userId: USER_ID,
        },
        {
          checkObjectExists: async (key) => key === availableKey,
          getAttachmentUploadPolicy: async () => uploadPolicy,
          requireStorageAvailable: () => storageConfig,
          upsertAttachmentsByOriginalKey: async () => {
            upsertCalled = true;
            return [];
          },
        },
        undefined,
        { manageTransaction: false, strictValidation: true }
      )
    ).rejects.toThrow();
    expect(upsertCalled).toBe(false);
  });
});
