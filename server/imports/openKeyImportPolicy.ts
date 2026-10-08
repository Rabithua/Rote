import { HTTPException } from 'hono/http-exception';
import { parseImportPayload } from './importSchema';

export const OPENKEY_IMPORT_BATCH_SIZE = 50;

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
  }
  return payload;
}
