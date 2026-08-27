import { describe, expect, it } from 'bun:test';
import type { UploadReservationManifestItem } from '../resources/service';
import type { FinalizeAttachmentBatchInput } from './types';
import { isDirectFinalUploadManifest, prepareDirectFinalUpload } from './directFinalUpload';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ATTACHMENT_ID = '11111111-1111-4111-8111-111111111111';
const BATCH_ID = '22222222-2222-4222-8222-222222222222';
const RESERVATION_ID = '33333333-3333-4333-8333-333333333333';
const NOTE_ID = '44444444-4444-4444-8444-444444444444';
const CLIENT_ID = '55555555-5555-4555-8555-555555555555';
const ORIGINAL_KEY = `users/${USER_ID}/attachments/${ATTACHMENT_ID}/original.jpg`;

const manifest = (): UploadReservationManifestItem[] => [
  {
    billable: true,
    contentType: 'image/jpeg',
    declaredBytes: '1024',
    finalKey: ORIGINAL_KEY,
    role: 'original',
    stagingKey: ORIGINAL_KEY,
    uuid: ATTACHMENT_ID,
  },
];

const input = (): FinalizeAttachmentBatchInput => ({
  attachments: [
    {
      clientId: CLIENT_ID,
      compressedKey: undefined,
      mediaKind: 'image',
      mimetype: 'image/jpeg',
      originalKey: ORIGINAL_KEY,
      size: 1024,
      uuid: ATTACHMENT_ID,
    },
  ],
  batchId: BATCH_ID,
  noteId: NOTE_ID,
  order: [{ clientId: CLIENT_ID }],
  reservationId: RESERVATION_ID,
});

describe('direct final attachment upload', () => {
  it('builds database uploads entirely from the reservation manifest', () => {
    const prepared = prepareDirectFinalUpload(
      input(),
      manifest(),
      USER_ID,
      'https://cdn.example.com'
    );

    expect(prepared.objects).toHaveLength(1);
    expect(prepared.objects[0].actualBytes).toBe(1024n);
    expect(prepared.uploads).toHaveLength(1);
    expect(prepared.uploads[0].url).toBe(`https://cdn.example.com/${ORIGINAL_KEY}`);
    expect(prepared.uploads[0].compressUrl).toBeNull();
    expect(prepared.uploads[0].details.mimetype).toBe('image/jpeg');
  });

  it('rejects a size claim that differs from the presigned manifest', () => {
    const mismatched = input();
    mismatched.attachments[0].size = 1023;

    expect(() =>
      prepareDirectFinalUpload(mismatched, manifest(), USER_ID, 'https://cdn.example.com')
    ).toThrow('resource_upload_manifest_mismatch');
  });

  it('does not treat staging reservations as direct final uploads', () => {
    const legacy = manifest();
    legacy[0].stagingKey = `users/${USER_ID}/staging/${RESERVATION_ID}/uploads/${ATTACHMENT_ID}.jpg`;

    expect(isDirectFinalUploadManifest(legacy)).toBe(false);
  });
});
