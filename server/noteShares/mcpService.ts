import { manageNoteShare, ShareNoteNotFound } from './repository';
import { getConfiguredFrontendOrigin, presentNoteShare } from './urls';

export function toPublicMcpNoteShareError(error: unknown): Error {
  if (error instanceof ShareNoteNotFound) return error;
  return new Error('share_request_failed');
}

async function manageMcpNoteShare(
  ownerId: string,
  noteId: string,
  operation: 'read' | 'create' | 'revoke'
) {
  try {
    return await manageNoteShare(ownerId, noteId, operation);
  } catch (error) {
    throw toPublicMcpNoteShareError(error);
  }
}

export async function getMcpNoteShare(ownerId: string, noteId: string) {
  return presentNoteShare(await manageMcpNoteShare(ownerId, noteId, 'read'));
}

export async function createMcpNoteShare(
  ownerId: string,
  noteId: string,
  frontendOrigin: string | null = getConfiguredFrontendOrigin()
) {
  // Resolve the public URL before creating a bearer token. A broken site
  // configuration therefore cannot leave an undistributable link behind.
  if (!frontendOrigin) throw new Error('share_frontend_unavailable');
  return presentNoteShare(await manageMcpNoteShare(ownerId, noteId, 'create'), frontendOrigin);
}

export async function revokeMcpNoteShare(ownerId: string, noteId: string) {
  await manageMcpNoteShare(ownerId, noteId, 'revoke');
  return { active: false } as const;
}
