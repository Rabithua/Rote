import type { AiMemoryMessage } from '@/state/aiChat';
import { messageCreatedAt, serializeMessages } from './messageConversion';
import type { ConversationScope, LocalConversation } from './types';

const CLAIM_KEY = 'rote:ai-conversations:legacy-claim:v1';
type LegacyClaim = { scopeKey: string; id: string; createdAt: string };

export function legacyImportAvailable(storage: Storage, scope: ConversationScope): boolean {
  const raw = storage.getItem('aiChatMessages');
  if (!raw) return false;
  const messages = JSON.parse(raw) as unknown;
  if (!Array.isArray(messages) || !messages.length) return false;
  const claimRaw = storage.getItem(CLAIM_KEY);
  const claim = claimRaw ? (JSON.parse(claimRaw) as LegacyClaim) : null;
  return !claim || claim.scopeKey === scope.key;
}

export function prepareLegacyImport(
  storage: Storage,
  scope: ConversationScope,
  interrupted: string
): LocalConversation | null {
  const raw = storage.getItem('aiChatMessages');
  if (!raw) return null;
  const messages = JSON.parse(raw) as AiMemoryMessage[];
  if (!Array.isArray(messages) || !messages.length) return null;
  const claimRaw = storage.getItem(CLAIM_KEY);
  const existing = claimRaw ? (JSON.parse(claimRaw) as LegacyClaim) : null;
  if (existing && existing.scopeKey !== scope.key) return null;
  const fallbackDate = new Date().toISOString();
  const claim = existing || {
    scopeKey: scope.key,
    id: `web-import-${crypto.randomUUID()}`,
    createdAt: messageCreatedAt(messages[0], fallbackDate),
  };
  if (!existing) storage.setItem(CLAIM_KEY, JSON.stringify(claim));
  return {
    id: claim.id,
    revision: null,
    createdAt: claim.createdAt,
    updatedAt: claim.createdAt,
    deletedAt: null,
    messages: serializeMessages(messages, claim.createdAt, interrupted),
  };
}

export function completeLegacyImport(storage: Storage, scope: ConversationScope, id: string) {
  const raw = storage.getItem(CLAIM_KEY);
  const claim = raw ? (JSON.parse(raw) as LegacyClaim) : null;
  if (claim?.scopeKey !== scope.key || claim.id !== id) return false;
  storage.removeItem('aiChatMessages');
  return true;
}
