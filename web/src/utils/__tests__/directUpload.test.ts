import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getResourceUploadErrorCode,
  getUploadErrorMessage,
  isResourceUploadPolicyError,
} from '../directUpload';

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          pages: {
            profile: {
              resources: {
                errors: { storageQuotaExceeded: 'Friendly quota guidance' },
              },
            },
          },
        },
      },
    },
  });
});

describe('resource upload errors', () => {
  it('extracts a stable error code from normalized API errors', () => {
    const error = Object.assign(new Error('resource_storage_quota_exceeded'), {
      code: 'resource_storage_quota_exceeded',
    });

    expect(getResourceUploadErrorCode(error)).toBe('resource_storage_quota_exceeded');
    expect(isResourceUploadPolicyError(error)).toBe(true);
    expect(getUploadErrorMessage(error)).toBe('Friendly quota guidance');
  });

  it('extracts a stable error code from an axios response body', () => {
    const error = {
      response: { data: { message: 'resource_upload_reservation_expired' } },
    };

    expect(getResourceUploadErrorCode(error)).toBe('resource_upload_reservation_expired');
    expect(isResourceUploadPolicyError(error)).toBe(true);
  });

  it('does not classify ordinary network failures as policy errors', () => {
    const error = new Error('Network Error');
    expect(getResourceUploadErrorCode(error)).toBeNull();
    expect(isResourceUploadPolicyError(error)).toBe(false);
  });
});
