import { describe, expect, it } from 'bun:test';
import { finalizeAttachmentReservation } from './finalizeReservation';
import { RESOURCE_ERROR_CODES } from '../resources/errors';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RESERVATION_ID = '22222222-2222-4222-8222-222222222222';
const LEASE_TOKEN = '33333333-3333-4333-8333-333333333333';
const UPLOAD_ID = '44444444-4444-4444-8444-444444444444';

function claim(stagingKey: string, finalKey: string) {
  return {
    kind: 'claimed' as const,
    leaseToken: LEASE_TOKEN,
    reservation: {
      id: RESERVATION_ID,
      manifest: [
        {
          billable: true,
          contentType: 'image/jpeg',
          declaredBytes: '12',
          finalKey,
          role: 'original' as const,
          stagingKey,
          uuid: UPLOAD_ID,
        },
      ],
    },
  } as never;
}

const input = {
  attachments: [
    {
      mimetype: 'image/jpeg',
      originalKey: `users/${USER_ID}/staging/${RESERVATION_ID}/uploads/${UPLOAD_ID}.jpg`,
      size: 12,
      uuid: UPLOAD_ID,
    },
  ],
  reservationId: RESERVATION_ID,
  scopes: [],
  userId: USER_ID,
};

describe('reservation attachment finalization', () => {
  it('promotes storage before entering the persistence transaction', async () => {
    const events: string[] = [];
    const result = await finalizeAttachmentReservation(input, {
      claimUploadReservationForFinalize: async () =>
        claim(input.attachments[0].originalKey, `users/${USER_ID}/uploads/${UPLOAD_ID}.jpg`),
      prepareReservationUpload: async () => {
        events.push('storage');
        return { objects: [], uploads: [] };
      },
      persistPreparedReservationUpload: async () => {
        events.push('database');
        return [{ id: 'attachment' }];
      },
    });

    expect(events).toEqual(['storage', 'database']);
    expect(result).toEqual([{ id: 'attachment' }]);
  });

  it('releases the finalize lease when storage promotion fails', async () => {
    let released = false;
    await expect(
      finalizeAttachmentReservation(input, {
        claimUploadReservationForFinalize: async () =>
          claim(input.attachments[0].originalKey, `users/${USER_ID}/uploads/${UPLOAD_ID}.jpg`),
        prepareReservationUpload: async () => {
          throw new Error('storage unavailable');
        },
        releaseUploadReservationFinalizeClaim: async () => {
          released = true;
        },
      })
    ).rejects.toThrow('storage unavailable');
    expect(released).toBe(true);
  });

  it('cancels previously issued direct-final reservations instead of accepting them', async () => {
    let cancelled = false;
    let released = false;
    const finalKey = `users/${USER_ID}/attachments/${UPLOAD_ID}/original.jpg`;
    await expect(
      finalizeAttachmentReservation(
        { ...input, attachments: [{ ...input.attachments[0], originalKey: finalKey }] },
        {
          cancelUploadReservation: async () => {
            cancelled = true;
          },
          claimUploadReservationForFinalize: async () => claim(finalKey, finalKey),
          releaseUploadReservationFinalizeClaim: async () => {
            released = true;
          },
        }
      )
    ).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.uploadManifestMismatch,
      status: 409,
    });
    expect(released).toBe(true);
    expect(cancelled).toBe(true);
  });
});
