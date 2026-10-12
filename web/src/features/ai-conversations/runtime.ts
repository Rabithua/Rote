import { atom, getDefaultStore } from 'jotai';
import { aiChatMessagesAtom, aiRunStateAtom, type AiMemoryMessage } from '@/state/aiChat';
import { conversationApi, isCurrentConversationScope } from './api';
import { deserializeMessages, serializeMessages } from './messageConversion';
import { AiConversationSync } from './sync';
import type { ConversationScope, ConversationView } from './types';

const store = getDefaultStore();
export const aiConversationViewAtom = atom<ConversationView>({
  scopeKey: null,
  conversations: [],
  selectedId: null,
  isLoading: false,
  hasPending: false,
  canKeepCopy: false,
  hasLegacy: false,
  canImportLegacy: false,
});

type RunLifecycle = {
  stop: () => void;
  reset: () => void;
  restore: (messages: AiMemoryMessage[], agentConversationId?: string) => void;
};
let lifecycle: RunLifecycle | undefined;
let displayedId: string | null = null;
let interruptedLabel = '';
let restoringSelection = false;

export function registerAiConversationRunLifecycle(next: RunLifecycle) {
  lifecycle = next;
}

const sync = new AiConversationSync(
  localStorage,
  conversationApi,
  (incoming) => {
    let view = incoming;
    let stoppedForSelection = false;
    if (
      !restoringSelection &&
      store.get(aiRunStateAtom).isSending &&
      displayedId !== view.selectedId
    ) {
      restoringSelection = true;
      lifecycle?.stop();
      lifecycle?.reset();
      restoringSelection = false;
      stoppedForSelection = true;
      view = sync.view;
    }
    store.set(aiConversationViewAtom, view);
    if (!store.get(aiRunStateAtom).isSending || displayedId !== view.selectedId) {
      const selected = view.conversations.find(
        (conversation) => conversation.id === view.selectedId
      );
      const messages = selected ? deserializeMessages(selected.messages) : [];
      store.set(aiChatMessagesAtom, messages);
      if (stoppedForSelection || displayedId !== view.selectedId)
        lifecycle?.restore(messages, selected?.agentConversationId);
      displayedId = view.selectedId;
    }
  },
  isCurrentConversationScope
);

export async function activateAiConversationScope(
  scope: ConversationScope | null,
  interrupted: string
) {
  interruptedLabel = interrupted;
  lifecycle?.stop();
  lifecycle?.reset();
  displayedId = null;
  await sync.activate(scope, interrupted);
}

export type AiConversationRunContext = { scopeKey: string; conversationId: string };

export function getAiConversationRunContext(): AiConversationRunContext | undefined {
  const scopeKey = sync.view.scopeKey;
  if (!scopeKey || !sync.isActiveScope) return undefined;
  if (!sync.selected || sync.selected.deletedAt) sync.create();
  sync.protectRun(sync.selected!.id);
  return { scopeKey, conversationId: sync.selected!.id };
}

export function isAiConversationRunCurrent(context: AiConversationRunContext) {
  return (
    sync.isActiveScope &&
    !sync.selected?.deletedAt &&
    sync.view.scopeKey === context.scopeKey &&
    sync.selected?.id === context.conversationId
  );
}

export const isAiConversationScopeReady = () => !sync.view.scopeKey || sync.isActiveScope;
export function releaseAiConversationRun(context: AiConversationRunContext | undefined) {
  if (context && sync.view.scopeKey === context.scopeKey) sync.releaseRun(context.conversationId);
}

export function persistAiConversationRun(
  context: AiConversationRunContext | undefined,
  messages: AiMemoryMessage[],
  agentConversationId?: string
) {
  if (
    !context ||
    sync.view.scopeKey !== context.scopeKey ||
    !sync.conversation(context.conversationId)
  )
    return;
  sync.save(context.conversationId, {
    createdAt: sync.conversation(context.conversationId)!.createdAt,
    messages: serializeMessages(
      messages,
      sync.conversation(context.conversationId)!.createdAt,
      interruptedLabel
    ),
    agentConversationId,
  });
}

export function selectAiConversation(id: string) {
  if (sync.selected?.id === id) return;
  lifecycle?.stop();
  lifecycle?.reset();
  sync.select(id);
}

export function newAiConversation() {
  lifecycle?.stop();
  lifecycle?.reset();
  sync.create();
}

export function deleteAiConversation() {
  lifecycle?.stop();
  lifecycle?.reset();
  const id = sync.selected?.id;
  if (id) sync.delete(id);
}

export const retryAiConversationSync = () => sync.refresh(interruptedLabel);
export function importLegacyAiConversation() {
  if (!sync.view.canImportLegacy) return;
  sync.importLegacy(interruptedLabel);
}
export function setAiConversationInterruptedLabel(label: string) {
  interruptedLabel = label;
}
export function keepAiConversationCopy() {
  lifecycle?.stop();
  lifecycle?.reset();
  sync.keepConflictCopy();
}
