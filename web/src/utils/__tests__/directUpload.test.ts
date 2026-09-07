import i18n from 'i18next';
import { del, post } from '../api';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  cancelUploadReservation,
  finalizeReservedUpload,
  getResourceUploadErrorCode,
  getUploadErrorMessage,
  isResourceUploadPolicyError,
  presignBrowserUpload,
} from '../directUpload';

vi.mock('../api', () => ({ del: vi.fn(), post: vi.fn() }));

afterEach(() => {
  vi.mocked(post).mockReset();
  vi.mocked(del).mockReset();
});

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          pages: {
            profile: {
              resources: {
                errors: {
                  storageQuotaExceeded: 'Friendly quota guidance',
                  attachmentBatchFinalizing: 'Please retry discard shortly',
                },
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

  it('localizes an active-finalizer cancellation response', () => {
    const error = {
      response: { data: { message: 'attachment_batch_finalizing' } },
    };

    expect(getUploadErrorMessage(error)).toBe('Please retry discard shortly');
  });

  it('does not classify ordinary network failures as policy errors', () => {
    const error = new Error('Network Error');
    expect(getResourceUploadErrorCode(error)).toBeNull();
    expect(isResourceUploadPolicyError(error)).toBe(false);
  });
});

describe('direct browser uploads', () => {
  it('requests reservation-scoped browser uploads and preserves the reservation identifier', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      data: {
        items: [
          {
            original: {
              key: 'users/user/attachments/upload/original.jpg',
              putUrl: 'https://put.example.com/original.jpg',
              url: 'https://cdn.example.com/original.jpg',
            },
            uuid: 'upload',
          },
        ],
        reservationId: 'reservation',
      },
    });

    const result = await presignBrowserUpload([
      {
        compressed: { contentType: 'image/webp', size: 256 },
        contentType: 'image/jpeg',
        filename: 'photo.jpg',
        size: 1024,
      },
    ]);

    expect(post).toHaveBeenCalledWith('/attachments/presign', {
      browserDirectUpload: true,
      files: [
        {
          compressed: { contentType: 'image/webp', size: 256 },
          contentType: 'image/jpeg',
          filename: 'photo.jpg',
          size: 1024,
        },
      ],
    });
    expect(result.reservationId).toBe('reservation');
  });

  it('passes the reservation identifier when finalizing an unbound attachment', async () => {
    vi.mocked(post).mockResolvedValue({ code: 0, data: [{ id: 'attachment' }] });

    await finalizeReservedUpload(
      [
        {
          mimetype: 'image/jpeg',
          originalKey: 'users/user/attachments/upload/original.jpg',
          size: 1024,
          uuid: 'upload',
        },
      ],
      'reservation'
    );

    expect(post).toHaveBeenCalledWith('/attachments/finalize', {
      attachments: [
        {
          mimetype: 'image/jpeg',
          originalKey: 'users/user/attachments/upload/original.jpg',
          size: 1024,
          uuid: 'upload',
        },
      ],
      noteId: undefined,
      reservationId: 'reservation',
    });
  });

  it('cancels an abandoned reservation', async () => {
    vi.mocked(del).mockResolvedValue({ code: 0 });

    await cancelUploadReservation('reservation');

    expect(del).toHaveBeenCalledWith('/attachments/reservations/reservation');
  });
});
