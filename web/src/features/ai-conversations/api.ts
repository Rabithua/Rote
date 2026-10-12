import { getApiUrl, refreshAccessToken } from '@/utils/api';
import { authService } from '@/utils/auth';
import { conversationScope } from './storage';
import type { Conversation, ConversationScope, ConversationSnapshot } from './types';

export class ConversationConflict extends Error {
  conversation: Conversation;
  constructor(conversation: Conversation) {
    super('Conversation revision conflict');
    this.conversation = conversation;
  }
}

export function isCurrentConversationScope(scope: ConversationScope) {
  const token = authService.getAccessToken() || authService.getRefreshToken();
  const userId = token ? authService.getUserInfoFromToken(token)?.userId : undefined;
  return userId === scope.userId && conversationScope(getApiUrl(), userId).key === scope.key;
}

async function request(
  scope: ConversationScope,
  path: string,
  signal: AbortSignal,
  init?: RequestInit
) {
  if (!isCurrentConversationScope(scope)) throw new Error('Conversation scope changed');
  let token = authService.getAccessToken();
  if ((!token || authService.isTokenExpired(token)) && authService.hasValidRefreshToken()) {
    token = await refreshAccessToken();
  }
  if (!isCurrentConversationScope(scope)) throw new Error('Conversation scope changed');
  const response = await fetch(`${scope.site}/ai/conversations${path}`, {
    ...init,
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!isCurrentConversationScope(scope)) throw new Error('Conversation scope changed');
  const body = await response.json();
  if (response.status === 409 && body.data?.conversation) {
    throw new ConversationConflict(body.data.conversation);
  }
  if (!response.ok) throw new Error(body.message || 'Conversation request failed');
  return body.data;
}

export const conversationApi = {
  async list(scope: ConversationScope, cursor: string | null, signal: AbortSignal) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    return request(scope, `?${query}`, signal) as Promise<{
      conversations: Conversation[];
      nextCursor: string | null;
    }>;
  },
  async put(
    scope: ConversationScope,
    id: string,
    snapshot: ConversationSnapshot,
    revision: number | null,
    signal: AbortSignal
  ) {
    const data = await request(scope, `/${encodeURIComponent(id)}`, signal, {
      method: 'PUT',
      body: JSON.stringify({ ...snapshot, baseRevision: revision }),
    });
    return data.conversation as Conversation;
  },
  async delete(scope: ConversationScope, id: string, revision: number, signal: AbortSignal) {
    const data = await request(
      scope,
      `/${encodeURIComponent(id)}?baseRevision=${revision}`,
      signal,
      {
        method: 'DELETE',
      }
    );
    return data.conversation as Conversation;
  },
};

export type ConversationApi = typeof conversationApi;
