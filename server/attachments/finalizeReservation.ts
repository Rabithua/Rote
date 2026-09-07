import { eq } from 'drizzle-orm';
import { attachments as attachmentsTable, users } from '../drizzle/schema';
import {
  assertUploadReservationGrantCurrent,
  cancelUploadReservation,
  claimUploadReservationForFinalize,
  completeClaimedUploadReservation,
  releaseUploadReservationFinalizeClaim,
  type UploadReservationFinalizeClaim,
  type UploadReservationManifestItem,
} from '../resources/service';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import type { UploadResult } from '../types/main';
import db from '../utils/drizzle';
import { upsertAttachmentsByOriginalKey } from '../utils/dbMethods';
import { validateRoteAttachmentDetails } from '../utils/fileValidation';
import { isDirectFinalUploadManifest } from './directFinalUpload';
import { completedLegacyFinalizeResult, finalizeAttachmentUploads } from './finalizeUpload';
import type { FinalizeAttachmentInput } from './types';

type ActiveFinalizeClaim = Extract<UploadReservationFinalizeClaim, { kind: 'claimed' }>;
type FinalizedManagedObject = UploadReservationManifestItem & { actualBytes: bigint };

type PreparedReservationUpload = {
  objects: FinalizedManagedObject[];
  uploads: UploadResult[];
};

type FinalizeReservationInput = {
  attachments: FinalizeAttachmentInput[];
  noteId?: string;
  reservationId: string;
  scopes: string[];
  userId: string;
};

export type FinalizeAttachmentReservationDependencies = {
  cancelUploadReservation: typeof cancelUploadReservation;
  claimUploadReservationForFinalize: typeof claimUploadReservationForFinalize;
  persistPreparedReservationUpload: typeof persistPreparedReservationUpload;
  prepareReservationUpload: typeof prepareReservationUpload;
  releaseUploadReservationFinalizeClaim: typeof releaseUploadReservationFinalizeClaim;
};

async function prepareReservationUpload(
  input: FinalizeReservationInput,
  claim: ActiveFinalizeClaim
): Promise<PreparedReservationUpload> {
  let uploads: UploadResult[] = [];
  let objects: FinalizedManagedObject[] = [];

  await finalizeAttachmentUploads(
    {
      attachments: input.attachments.map((attachment) => ({ ...attachment })),
      noteId: input.noteId,
      reservationId: input.reservationId,
      scopes: input.scopes,
      userId: input.userId,
    },
    {
      completeUploadReservation: async (params) => {
        objects = params.objects;
      },
      getPendingUploadReservation: async () => claim.reservation,
      upsertAttachmentsByOriginalKey: async (_userId, _noteId, preparedUploads) => {
        uploads = preparedUploads;
        return preparedUploads.map((upload, index) => ({
          ...upload,
          id: `prepared-${index}`,
          roteid: input.noteId ?? null,
        }));
      },
    },
    undefined,
    { manageTransaction: false, strictValidation: true }
  );

  if (uploads.length !== input.attachments.length) {
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
  }
  return { objects, uploads };
}

async function persistPreparedReservationUpload(params: {
  claim: ActiveFinalizeClaim;
  input: FinalizeReservationInput;
  prepared: PreparedReservationUpload;
}): Promise<any[]> {
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, params.input.userId))
      .limit(1)
      .for('update');
    if (!user) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    await assertUploadReservationGrantCurrent(transaction, params.claim.reservation, new Date());

    if (params.input.noteId) {
      const currentAttachments = await transaction
        .select({ details: attachmentsTable.details })
        .from(attachmentsTable)
        .where(eq(attachmentsTable.roteid, params.input.noteId))
        .for('update');
      validateRoteAttachmentDetails([
        ...currentAttachments,
        ...params.prepared.uploads.map((upload) => ({ details: upload.details })),
      ]);
    }

    const finalized = await upsertAttachmentsByOriginalKey(
      params.input.userId,
      params.input.noteId,
      params.prepared.uploads,
      transaction
    );
    const completed = await completeClaimedUploadReservation(
      {
        batchId: params.input.reservationId,
        leaseToken: params.claim.leaseToken,
        objects: params.prepared.objects,
        reservationId: params.input.reservationId,
        result: finalized,
        userId: params.input.userId,
      },
      transaction
    );
    return completedLegacyFinalizeResult(completed);
  });
}

const defaultDependencies: FinalizeAttachmentReservationDependencies = {
  cancelUploadReservation,
  claimUploadReservationForFinalize,
  persistPreparedReservationUpload,
  prepareReservationUpload,
  releaseUploadReservationFinalizeClaim,
};

/**
 * Finalizes a managed browser upload without holding a database transaction
 * while storage objects are inspected and promoted from staging.
 */
export async function finalizeAttachmentReservation(
  input: FinalizeReservationInput,
  dependencyOverrides: Partial<FinalizeAttachmentReservationDependencies> = {}
): Promise<any[]> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const reservationId = input.reservationId.toLowerCase();
  const normalizedInput = { ...input, reservationId };
  const claimResult = await dependencies.claimUploadReservationForFinalize({
    batchId: reservationId,
    reservationId,
    userId: input.userId,
  });
  if (claimResult.kind === 'completed') {
    return completedLegacyFinalizeResult(claimResult.result);
  }
  const claim: ActiveFinalizeClaim = claimResult;

  if (isDirectFinalUploadManifest(claim.reservation.manifest)) {
    await dependencies.releaseUploadReservationFinalizeClaim({
      batchId: reservationId,
      leaseToken: claim.leaseToken,
      reservationId,
      userId: input.userId,
    });
    await dependencies.cancelUploadReservation(input.userId, reservationId);
    throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch, 409);
  }

  try {
    const prepared = await dependencies.prepareReservationUpload(normalizedInput, claim);
    return await dependencies.persistPreparedReservationUpload({
      claim,
      input: normalizedInput,
      prepared,
    });
  } catch (error) {
    await dependencies.releaseUploadReservationFinalizeClaim({
      batchId: reservationId,
      leaseToken: claim.leaseToken,
      reservationId,
      userId: input.userId,
    });
    throw error;
  }
}
