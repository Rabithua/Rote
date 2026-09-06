import { del, get, publicGet, put } from '@/utils/api';
import type { NoteShareLink, SharedNote } from './types';

type Response<T> = { data: T };

export async function getNoteShare(noteId: string, signal?: AbortSignal) {
  const response = await get<Response<NoteShareLink | null>>(`/notes/${noteId}/share`, undefined, {
    signal,
  });
  return response.data;
}

export async function createNoteShare(noteId: string) {
  const response = await put<Response<NoteShareLink>>(`/notes/${noteId}/share`);
  return response.data;
}

export async function revokeNoteShare(noteId: string) {
  await del(`/notes/${noteId}/share`);
}

export async function getSharedNote(token: string, signal: AbortSignal) {
  const response = await publicGet<Response<SharedNote>>(
    `/shares/${encodeURIComponent(token)}`,
    undefined,
    {
      signal,
      withCredentials: false,
    }
  );
  return response.data;
}

export function noteShareUrl(token: string) {
  return `${window.location.origin}/s/${token}`;
}
