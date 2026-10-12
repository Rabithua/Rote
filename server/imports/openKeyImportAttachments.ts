import { and, eq, inArray } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { getAttachmentUploadPolicy } from '../attachments/uploadPolicy';
import { attachments } from '../drizzle/schema';
import db from '../utils/drizzle';
import type { ImportPayload } from './importSchema';
import { importAttachmentIncludesVideo, requireImportPermissions } from './openKeyImportPolicy';

export async function authorizeOpenKeyImportAttachments(
  userId: string,
  permissions: string[],
  payload: ImportPayload
) {
  const incoming = payload.notes.flatMap((note) => note.attachments ?? []);
  if (incoming.length === 0) return;
  requireImportPermissions(permissions, ['UPLOADATTACHMENT']);
  const ids = incoming.flatMap((attachment) => (attachment.id ? [attachment.id] : []));
  // Binding uses stored metadata, so a caller cannot relabel an existing video as an image.
  const stored = ids.length
    ? await db
        .select({ details: attachments.details })
        .from(attachments)
        .where(and(eq(attachments.userid, userId), inArray(attachments.id, ids)))
    : [];
  const hasVideo = [...incoming, ...stored].some((attachment) => {
    const details = attachment.details;
    return Boolean(
      details &&
      typeof details === 'object' &&
      importAttachmentIncludesVideo(details as Record<string, unknown>)
    );
  });
  if (hasVideo) requireImportPermissions(permissions, ['UPLOADVIDEO']);
  const policy = await getAttachmentUploadPolicy(userId);
  if (!policy.canUploadAttachments) {
    throw new HTTPException(403, { message: 'capability_required:attachment.upload' });
  }
  if (hasVideo && !policy.canUploadVideo) {
    throw new HTTPException(403, { message: 'capability_required:attachment.video.upload' });
  }
}
