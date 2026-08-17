import { describe, expect, it } from 'bun:test';
import {
  collectOwnedAttachmentObjectKeys,
  countObjectKeyReferences,
  effectiveOfficialStorageEnforcement,
  reportedOfficialUsedBytes,
  reservationCleanupKeys,
  resolveOfficialStorageState,
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
  it('does not report a placeholder zero before the user baseline is authoritative', () => {
    expect(reportedOfficialUsedBytes(null, 'running')).toBeNull();
    expect(
      reportedOfficialUsedBytes({ usedBytes: 123n, reconciledAt: null }, 'running')
    ).toBeNull();
    expect(
      reportedOfficialUsedBytes(
        { usedBytes: 123n, reconciledAt: new Date('2026-08-14T00:00:00.000Z') },
        'running'
      )
    ).toBe('123');
    expect(reportedOfficialUsedBytes(null, 'complete')).toBe('0');
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

describe('official storage limits', () => {
  it('keeps unlimited users uploadable after they exceed either free or Pro quotas', () => {
    for (const limitBytes of [500_000_000n, 10_000_000_000n]) {
      expect(
        resolveOfficialStorageState({
          enforcement: 'enforce',
          reportedUsedBytes: '12000000000',
          usedBytes: 12_000_000_000n,
          reservedBytes: 1_000n,
          limitBytes,
          unlimited: true,
        })
      ).toEqual({
        enforcement: 'enforce',
        usedBytes: '12000000000',
        reservedBytes: '1000',
        limitBytes: null,
        overLimit: false,
        canUpload: true,
      });
    }
  });

  it('restores enforcement against the supplied free or Pro quota after unlimited is revoked', () => {
    const free = resolveOfficialStorageState({
      enforcement: 'enforce',
      reportedUsedBytes: '500000000',
      usedBytes: 500_000_000n,
      reservedBytes: 0n,
      limitBytes: 500_000_000n,
      unlimited: false,
    });
    const pro = resolveOfficialStorageState({
      enforcement: 'enforce',
      reportedUsedBytes: '500000000',
      usedBytes: 500_000_000n,
      reservedBytes: 0n,
      limitBytes: 10_000_000_000n,
      unlimited: false,
    });

    expect(free).toMatchObject({
      limitBytes: '500000000',
      overLimit: true,
      canUpload: false,
    });
    expect(pro).toMatchObject({
      limitBytes: '10000000000',
      overLimit: false,
      canUpload: true,
    });
  });
});
