import { describe, expect, it } from 'bun:test';
import {
  collectOwnedAttachmentObjectKeys,
  countObjectKeyReferences,
  effectiveOfficialStorageEnforcement,
  reservationCleanupKeys,
  type UploadReservationManifestItem,
} from './service';

const manifest: UploadReservationManifestItem[] = [
  {
    uuid: 'original',
    role: 'original',
    stagingKey: 'users/user/staging/session/original.jpg',
    finalKey: 'users/user/uploads/original.jpg',
    declaredBytes: '12',
    contentType: 'image/jpeg',
    billable: true,
  },
  {
    uuid: 'cover',
    role: 'compressed',
    stagingKey: 'users/user/compressed/cover.jpg',
    finalKey: 'users/user/compressed/cover.jpg',
    declaredBytes: null,
    contentType: 'image/jpeg',
    billable: false,
  },
];

describe('resource cleanup helpers', () => {
  it('never enables official enforcement before reconciliation completes', () => {
    expect(effectiveOfficialStorageEnforcement('enforce', 'pending')).toBe('observe');
    expect(effectiveOfficialStorageEnforcement('enforce', 'failed')).toBe('observe');
    expect(effectiveOfficialStorageEnforcement('enforce', 'complete')).toBe('enforce');
    expect(effectiveOfficialStorageEnforcement('observe', 'complete')).toBe('observe');
  });
  it('collects staging keys and optionally final keys without duplicates', () => {
    expect(reservationCleanupKeys(manifest, false)).toEqual([
      'users/user/staging/session/original.jpg',
      'users/user/compressed/cover.jpg',
    ]);
    expect(reservationCleanupKeys(manifest, true)).toEqual([
      'users/user/staging/session/original.jpg',
      'users/user/uploads/original.jpg',
      'users/user/compressed/cover.jpg',
    ]);
  });

  it('collects every owned legacy attachment role without accepting foreign keys', () => {
    expect(
      collectOwnedAttachmentObjectKeys(
        {
          key: 'users/user/uploads/original.heic',
          compressKey: 'users/user/compressed/cover.jpg',
          posterKey: 'users/user/posters/poster.jpg',
          pairedVideoKey: 'users/user/uploads/live.mov',
          livePhotoVideoKey: 'users/user/uploads/live.mov',
          livePhoto: { pairedVideoKey: 'users/user/uploads/nested.mov' },
          unrelated: 'users/other/uploads/foreign.jpg',
        },
        'user'
      )
    ).toEqual([
      'users/user/uploads/original.heic',
      'users/user/compressed/cover.jpg',
      'users/user/posters/poster.jpg',
      'users/user/uploads/live.mov',
      'users/user/uploads/nested.mov',
    ]);
  });

  it('preserves duplicate keys so batch deletion can release every reference', () => {
    const first = collectOwnedAttachmentObjectKeys(
      { key: 'users/user/uploads/shared.jpg' },
      'user'
    );
    const second = collectOwnedAttachmentObjectKeys(
      { key: 'users/user/uploads/shared.jpg' },
      'user'
    );
    expect([...first, ...second]).toEqual([
      'users/user/uploads/shared.jpg',
      'users/user/uploads/shared.jpg',
    ]);
    expect(countObjectKeyReferences([...first, ...second])).toEqual(
      new Map([['users/user/uploads/shared.jpg', 2]])
    );
  });
});
