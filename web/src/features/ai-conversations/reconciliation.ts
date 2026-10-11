import type {
  Conversation,
  ConversationCache,
  ConversationSnapshot,
  LocalConversation,
} from './types';

export function snapshotOf(conversation: LocalConversation): ConversationSnapshot {
  return {
    createdAt: conversation.createdAt,
    agentConversationId: conversation.agentConversationId,
    messages: conversation.messages,
  };
}

export function sameSnapshot(a: ConversationSnapshot, b: ConversationSnapshot) {
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, ordered(item)])
      );
    }
    return value;
  };
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}

export function reconcileConversation(
  cache: ConversationCache,
  remote: Conversation,
  protectedRun = false
) {
  const pending = cache.pending[remote.id];
  const current = cache.conversations[remote.id];
  if (!remote.deletedAt && current?.deletedAt && !pending?.delete) return;
  const knownRevision = Math.max(current?.revision || 0, pending?.conflict?.revision || 0);
  if (remote.revision < knownRevision) return;
  if (remote.deletedAt) {
    cache.conversations[remote.id] = remote;
    if (pending && !pending.delete) pending.conflict = remote;
    else delete cache.pending[remote.id];
    return;
  }
  if (!pending) {
    if (protectedRun && current && !sameSnapshot(snapshotOf(current), snapshotOf(remote))) {
      cache.pending[remote.id] = { snapshot: snapshotOf(current), delete: false, conflict: remote };
      return;
    }
    cache.conversations[remote.id] = remote;
    return;
  }
  const local = cache.conversations[remote.id];
  if (pending.delete) {
    if (local) local.revision = remote.revision;
    delete pending.conflict;
    return;
  }
  if (sameSnapshot(pending.snapshot, snapshotOf(remote))) {
    if (local) local.revision = remote.revision;
    if (!pending.delete) {
      cache.conversations[remote.id] = remote;
      delete cache.pending[remote.id];
    }
  } else if (local?.revision !== remote.revision) {
    pending.conflict = remote;
  }
}
