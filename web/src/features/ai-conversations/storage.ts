import type { ConversationCache, ConversationScope } from './types';

export function conversationScope(site: string, userId: string): ConversationScope {
  const normalized = new URL(site);
  normalized.pathname = normalized.pathname.replace(/\/+$/, '');
  normalized.search = '';
  normalized.hash = '';
  const base = normalized.toString().replace(/\/+$/, '');
  return { site: base, userId, key: JSON.stringify([base, userId]) };
}

export const emptyConversationCache = (): ConversationCache => ({
  conversations: {},
  pending: {},
  selectedId: null,
});

export function cacheKey(scope: ConversationScope) {
  return `rote:ai-conversations:v1:${scope.key}`;
}

export function readConversationCache(
  storage: Storage,
  scope: ConversationScope
): ConversationCache {
  const raw = storage.getItem(cacheKey(scope));
  if (!raw) return emptyConversationCache();
  const cache = JSON.parse(raw) as ConversationCache;
  if (!cache.conversations || !cache.pending) throw new Error('Invalid conversation cache');
  return cache;
}

export function writeConversationCache(
  storage: Storage,
  scope: ConversationScope,
  cache: ConversationCache
) {
  storage.setItem(cacheKey(scope), JSON.stringify(cache));
}
