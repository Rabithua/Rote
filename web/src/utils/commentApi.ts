import type { RoteComment } from '@/types/main';
import { del, get, post } from './api';

export async function getRoteComments(roteid: string): Promise<RoteComment[]> {
  return get(`/notes/${roteid}/comments`).then((res) => res.data);
}

export async function getRoteCommentCount(roteid: string): Promise<number> {
  return get(`/notes/${roteid}/comments/count`).then((res) => res.data.count as number);
}

export async function getRoteCommentCounts(
  roteids: string[]
): Promise<Record<string, number>> {
  return post('/notes/comments/counts', { ids: roteids }).then((res) => res.data.counts);
}

export async function createRoteComment(
  roteid: string,
  data: { content: string; parentId?: string | null }
): Promise<RoteComment> {
  return post(`/notes/${roteid}/comments`, data).then((res) => res.data);
}

export async function deleteRoteComment(roteid: string, commentId: string): Promise<RoteComment> {
  return del(`/notes/${roteid}/comments/${commentId}`).then((res) => res.data);
}
