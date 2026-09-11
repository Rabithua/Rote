import { and, eq } from 'drizzle-orm';
import { attachments, rotes } from '../drizzle/schema';
import { RESOURCE_ERROR_CODES, ResourcePolicyError } from '../resources/errors';
import type { UploadResult } from '../types/main';
import { upsertAttachmentsByOriginalKey } from '../utils/dbMethods';
import { validateRoteAttachmentDetails } from '../utils/fileValidation';
import type { AttachmentTransaction } from './directUploadTransaction';

/** Persists browser uploads used outside the ordered note-batch endpoint. */
export async function persistDirectAttachments(
  transaction: AttachmentTransaction,
  input: { userId: string; noteId?: string },
  uploads: UploadResult[]
) {
  if (input.noteId) {
    const [note] = await transaction
      .select({ id: rotes.id })
      .from(rotes)
      .where(and(eq(rotes.id, input.noteId), eq(rotes.authorid, input.userId)))
      .limit(1)
      .for('update');
    if (!note) throw new ResourcePolicyError(RESOURCE_ERROR_CODES.uploadManifestMismatch);
    const existing = await transaction
      .select({ details: attachments.details })
      .from(attachments)
      .where(eq(attachments.roteid, input.noteId));
    validateRoteAttachmentDetails([...existing, ...uploads.map(({ details }) => ({ details }))]);
  }
  return upsertAttachmentsByOriginalKey(input.userId, input.noteId, uploads, transaction);
}
