import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { S3Client } from '@aws-sdk/client-s3';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../drizzle/schema';
import type { FinalizeAttachmentBatchInput } from './types';
import type { UploadReservationManifestItem } from '../resources/service';

// Run only against a disposable database with the repository schema installed.
process.env.POSTGRESQL_URL ||= 'postgres://test:test@127.0.0.1:5432/unused';
const { default: db, closeDatabase } = await import('../utils/drizzle');
const { configManager } = await import('../utils/config');
const { finalizeAttachmentBatch } = await import('./finalizeBatch');
const { finalizeAttachmentReservation } = await import('./finalizeReservation');
const { cancelUploadReservation } = await import('../resources/service');

describe.skipIf(process.env.ROTE_ATTACHMENT_INTEGRATION !== '1')(
  'direct finalize database contract',
  () => {
    const owner = randomUUID();
    const objectKeys: string[] = [];
    const storage = spyOn(S3Client.prototype, 'send');

    beforeAll(async () => {
      await db
        .insert(schema.users)
        .values({ id: owner, username: owner, email: `${owner}@example.invalid` });
      await db
        .insert(schema.settings)
        .values({
          group: 'storage',
          config: {
            endpoint: 'https://storage.invalid',
            accessKeyId: 'test',
            secretAccessKey: 'test',
            bucket: 'test',
            urlPrefix: 'https://cdn.invalid',
          },
        })
        .onConflictDoUpdate({
          target: schema.settings.group,
          set: {
            config: {
              endpoint: 'https://storage.invalid',
              accessKeyId: 'test',
              secretAccessKey: 'test',
              bucket: 'test',
              urlPrefix: 'https://cdn.invalid',
            },
          },
        });
      await configManager.initialize();
      storage.mockImplementation(() => {
        throw new Error('finalize must not access object storage');
      });
    });

    afterAll(async () => {
      expect(storage).not.toHaveBeenCalled();
      storage.mockRestore();
      await db
        .delete(schema.resourceCleanupOutbox)
        .where(inArray(schema.resourceCleanupOutbox.objectKey, objectKeys));
      await db
        .delete(schema.resourceStorageObjects)
        .where(eq(schema.resourceStorageObjects.ownerId, owner));
      await db.delete(schema.rotes).where(eq(schema.rotes.authorid, owner));
      await db.delete(schema.users).where(eq(schema.users.id, owner));
      await closeDatabase();
    });

    async function fixture(count = 3, video = false) {
      const noteId = randomUUID();
      const reservationId = randomUUID();
      const input: FinalizeAttachmentBatchInput = {
        noteId,
        reservationId,
        batchId: randomUUID(),
        attachments: [],
        order: [],
      };
      const manifest: UploadReservationManifestItem[] = [];
      for (let index = 0; index < count; index++) {
        const uuid = randomUUID();
        const clientId = randomUUID();
        const originalKey = `users/${owner}/uploads/${uuid}.${video ? 'mp4' : 'jpg'}`;
        const previewKey = `users/${owner}/${video ? 'posters' : 'compressed'}/${uuid}.jpg`;
        input.attachments.push({
          uuid,
          clientId,
          originalKey,
          size: 999999,
          mimetype: 'image/png',
          ...(video ? { posterKey: previewKey } : { compressedKey: previewKey }),
        });
        input.order.push({ clientId });
        manifest.push(
          {
            uuid,
            role: 'original',
            stagingKey: originalKey,
            finalKey: originalKey,
            declaredBytes: '123',
            contentType: video ? 'video/mp4' : 'image/jpeg',
            billable: true,
          },
          {
            uuid,
            role: video ? 'poster' : 'compressed',
            stagingKey: previewKey,
            finalKey: previewKey,
            declaredBytes: '12',
            contentType: 'image/jpeg',
            billable: false,
          }
        );
      }
      objectKeys.push(...manifest.map((item) => item.finalKey));
      await db
        .insert(schema.rotes)
        .values({ id: noteId, authorid: owner, content: 'Disposable direct upload test' });
      await db.insert(schema.resourceUploadReservations).values({
        id: reservationId,
        userId: owner,
        manifest,
        reservedBytes: BigInt(count * 123),
        expiresAt: new Date(Date.now() + 3600_000),
        credentialExpiresAt: new Date(Date.now() + 900_000),
      });
      await db
        .insert(schema.resourceStorageAccounts)
        .values({ userId: owner })
        .onConflictDoNothing();
      return input;
    }

    it('confirms three images with zero storage calls in one transaction', async () => {
      const input = await fixture();
      const transact = db.transaction.bind(db);
      const transaction = spyOn(db, 'transaction').mockImplementation(transact);
      const start = performance.now();
      try {
        const result = await finalizeAttachmentBatch({ input, userId: owner, scopes: [] });
        expect(result.attachments).toHaveLength(3);
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(storage).not.toHaveBeenCalled();
        const [reservation] = await db
          .select()
          .from(schema.resourceUploadReservations)
          .where(eq(schema.resourceUploadReservations.id, input.reservationId!));
        expect(reservation.status).toBe('completed');
        expect(reservation.finalizingLeaseToken).toBeNull();
        expect(
          await db
            .select()
            .from(schema.resourceCleanupOutbox)
            .where(
              inArray(
                schema.resourceCleanupOutbox.objectKey,
                input.attachments.map((item) => item.originalKey)
              )
            )
        ).toHaveLength(0);
        process.stdout.write(
          `Three-image database finalize: ${Math.round(performance.now() - start)}ms; storage calls: 0\n`
        );
      } finally {
        transaction.mockRestore();
      }
    });

    it('serializes concurrent confirmation and charges only once', async () => {
      const input = await fixture(1);
      const [before] = await db
        .select()
        .from(schema.resourceStorageAccounts)
        .where(eq(schema.resourceStorageAccounts.userId, owner));
      const results = await Promise.all(
        [1, 2].map(() => finalizeAttachmentBatch({ input, userId: owner, scopes: [] }))
      );
      expect(results[0].orderedAttachmentIds).toEqual(results[1].orderedAttachmentIds);
      expect(
        await db
          .select()
          .from(schema.attachments)
          .where(eq(schema.attachments.roteid, input.noteId))
      ).toHaveLength(1);
      const [after] = await db
        .select()
        .from(schema.resourceStorageAccounts)
        .where(eq(schema.resourceStorageAccounts.userId, owner));
      expect(after.usedBytes - before.usedBytes).toBe(123n);
    });

    it('rolls back a failed ordering write and permits the same batch to be resubmitted', async () => {
      const input = await fixture(1);
      await expect(
        finalizeAttachmentBatch({
          input: { ...input, order: [...input.order, { attachmentId: randomUUID() }] },
          userId: owner,
          scopes: [],
        })
      ).rejects.toThrow();
      expect(
        await db
          .select()
          .from(schema.attachments)
          .where(eq(schema.attachments.roteid, input.noteId))
      ).toHaveLength(0);
      const result = await finalizeAttachmentBatch({ input, userId: owner, scopes: [] });
      expect(result.attachments).toHaveLength(1);
    });

    it('supports video and poster declarations without opening either object', async () => {
      const input = await fixture(1, true);
      const result = await finalizeAttachmentBatch({
        input,
        userId: owner,
        scopes: ['video:upload'],
      });
      expect(result.attachments[0]).toMatchObject({ details: { mediaKind: 'video', size: 123 } });
    });

    it('also confirms standalone browser uploads without a lease or storage IO', async () => {
      const input = await fixture(1);
      const result = await finalizeAttachmentReservation({
        attachments: input.attachments,
        reservationId: input.reservationId!,
        userId: owner,
        scopes: [],
      });
      expect(result).toHaveLength(1);
    });

    it('cancels pending final keys after write credentials expire, but never cleans a completed batch', async () => {
      const input = await fixture(1);
      await cancelUploadReservation(owner, input.reservationId!);
      const cleanup = await db
        .select()
        .from(schema.resourceCleanupOutbox)
        .where(
          inArray(schema.resourceCleanupOutbox.objectKey, [
            input.attachments[0].originalKey,
            input.attachments[0].compressedKey!,
          ])
        );
      expect(cleanup).toHaveLength(2);
      expect(cleanup.every((item) => item.nextAttemptAt.getTime() > Date.now())).toBe(true);
      const completed = await fixture(1);
      await finalizeAttachmentBatch({ input: completed, userId: owner, scopes: [] });
      await cancelUploadReservation(owner, completed.reservationId!);
      expect(
        await db
          .select()
          .from(schema.resourceCleanupOutbox)
          .where(eq(schema.resourceCleanupOutbox.objectKey, completed.attachments[0].originalKey))
      ).toHaveLength(0);
    });
  }
);
