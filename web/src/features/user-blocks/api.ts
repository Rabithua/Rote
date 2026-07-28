import type { BlockedUserSummary } from '@/types/main';
import { del, get, put } from '@/utils/api';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

export type UserBlockMutation = {
  blocked: boolean;
  targetUserId: string;
};

export async function listBlockedUsers(): Promise<BlockedUserSummary[]> {
  const response = await get<ApiEnvelope<BlockedUserSummary[]>>('/users/me/blocks');
  return response.data;
}

export async function blockUser(targetUserId: string): Promise<UserBlockMutation> {
  const response = await put<ApiEnvelope<UserBlockMutation>>(`/users/me/blocks/${targetUserId}`);
  return response.data;
}

export async function unblockUser(targetUserId: string): Promise<UserBlockMutation> {
  const response = await del<ApiEnvelope<UserBlockMutation>>(`/users/me/blocks/${targetUserId}`);
  return response.data;
}
