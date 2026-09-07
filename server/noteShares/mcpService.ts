import { manageNoteShare } from './repository';
import { getConfiguredFrontendOrigin, presentNoteShare } from './urls';

export async function getMcpNoteShare(ownerId: string, noteId: string) {
  return presentNoteShare(await manageNoteShare(ownerId, noteId, 'read'));
}

export async function createMcpNoteShare(
  ownerId: string,
  noteId: string,
  frontendOrigin: string | null = getConfiguredFrontendOrigin()
) {
  // Resolve the public URL before creating a bearer token. A broken site
  // configuration therefore cannot leave an undistributable link behind.
  if (!frontendOrigin) throw new Error('share_frontend_unavailable');
  return presentNoteShare(await manageNoteShare(ownerId, noteId, 'create'), frontendOrigin);
}

export async function revokeMcpNoteShare(ownerId: string, noteId: string) {
  await manageNoteShare(ownerId, noteId, 'revoke');
  return { active: false } as const;
}
