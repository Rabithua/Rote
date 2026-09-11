import { describe, expect, it } from 'bun:test';
import { prepareDirectFinalUpload } from './directFinalUpload';
import type { UploadReservationManifestItem } from '../resources/service';

const key = 'users/owner/uploads/photo.jpg';
const manifest: UploadReservationManifestItem[] = [
  {
    uuid: 'photo',
    role: 'original',
    stagingKey: key,
    finalKey: key,
    declaredBytes: '123',
    contentType: 'image/jpeg',
    billable: true,
  },
];

describe('owner-locked client metadata policy', () => {
  it('accepts client declarations without checking that the object exists or matches', () => {
    const result = prepareDirectFinalUpload(
      [{ uuid: 'photo', originalKey: key, size: 999, mimetype: 'image/png' }],
      manifest,
      'owner',
      'https://cdn.invalid'
    );
    // Presign declarations are client data too; finalize does not compare them
    // to the submitted hints, inspect the object, or schedule verification.
    expect(result.objects[0].actualBytes).toBe(123n);
    expect(result.uploads[0].details).toMatchObject({ size: 123, mimetype: 'image/jpeg' });
  });

  it('still rejects another owner or keys outside the issued upload manifest', () => {
    expect(() =>
      prepareDirectFinalUpload(
        [{ uuid: 'photo', originalKey: key }],
        manifest,
        'someone-else',
        'https://cdn.invalid'
      )
    ).toThrow('resource_upload_manifest_mismatch');
    expect(() =>
      prepareDirectFinalUpload(
        [{ uuid: 'photo', originalKey: `${key}.other` }],
        manifest,
        'owner',
        'https://cdn.invalid'
      )
    ).toThrow('resource_upload_manifest_mismatch');
  });
});
