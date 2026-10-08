import { HTTPException } from 'hono/http-exception';
import { isVideoContentType, inferAttachmentMediaKind } from '../utils/fileValidation';
import { parseImportPayload } from './importSchema';

export const OPENKEY_IMPORT_BATCH_SIZE = 50;

export function importAttachmentIncludesVideo(details: Record<string, unknown>) {
  const mimetype = typeof details.mimetype === 'string' ? details.mimetype : undefined;
  const contentType = typeof details.contentType === 'string' ? details.contentType : undefined;
  const kind = inferAttachmentMediaKind({
    mimetype,
    contentType,
    key: typeof details.key === 'string' ? details.key : undefined,
    posterKey: typeof details.posterKey === 'string' ? details.posterKey : undefined,
    pairedVideoKey: typeof details.pairedVideoKey === 'string' ? details.pairedVideoKey : undefined,
    livePhotoVideoKey:
      typeof details.livePhotoVideoKey === 'string' ? details.livePhotoVideoKey : undefined,
  });
  return (
    details.mediaKind === 'video' ||
    details.mediaKind === 'livePhoto' ||
    isVideoContentType(mimetype) ||
    isVideoContentType(contentType) ||
    kind === 'video' ||
    kind === 'livePhoto'
  );
}

export function requireImportPermissions(permissions: string[], required: string[]) {
  const missing = required.find((permission) => !permissions.includes(permission));
  if (missing) throw new HTTPException(403, { message: `openkey_permission_required:${missing}` });
}

export function parseOpenKeyImport(data: unknown, permissions: string[], planning = false) {
  requireImportPermissions(permissions, ['SENDROTE', 'GETROTE']);
  const input = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const payload = parseImportPayload({
    ...input,
    importOptions: { visibilityStrategy: 'private', ...((input.importOptions as object) ?? {}) },
  });
  if (
    payload.notes.length > OPENKEY_IMPORT_BATCH_SIZE ||
    payload.articles.length > OPENKEY_IMPORT_BATCH_SIZE
  ) {
    throw new HTTPException(422, { message: 'import_batch_limit:50' });
  }
  if (payload.importOptions.existingStrategy === 'overwrite') {
    requireImportPermissions(permissions, ['EDITROTE']);
  }
  if (payload.articles.length > 0) {
    // Articles use ID-based upserts in the formal importer; both permissions are required.
    requireImportPermissions(permissions, ['SENDARTICLE', 'EDITARTICLE']);
  }
  if (!planning && payload.notes.some((note) => (note.attachments?.length ?? 0) > 0)) {
    requireImportPermissions(permissions, ['UPLOADATTACHMENT']);
    if (
      payload.notes.some((note) =>
        note.attachments?.some((attachment) => importAttachmentIncludesVideo(attachment.details))
      )
    ) {
      requireImportPermissions(permissions, ['UPLOADVIDEO']);
    }
  }
  return payload;
}
