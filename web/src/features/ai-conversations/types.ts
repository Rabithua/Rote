import type { AiMessageMetrics, AiMemoryMessage } from '@/state/aiChat';
import type { AiRetrievalSummary } from '@/utils/aiTypes';

export type ConversationTimeline = {
  id: string;
  type: 'progress' | 'tool';
  phase?: string;
  toolName?: string;
  toolStatus?: string;
  message?: string;
  status: 'running' | 'done' | 'error';
  updatedAt: string;
  retrieval?: AiRetrievalSummary;
};

export type ConversationOutput = {
  id: string;
  phase: string;
  text?: string;
  thinking?: string;
  thinkingPhase?: string;
  kind?: 'process' | 'answer';
  status?: ConversationTimeline;
};

export type ConversationMessage = Omit<
  AiMemoryMessage,
  'outputs' | 'timeline' | 'isStreaming' | 'createdAt' | 'metrics' | 'plan' | 'pendingPlan'
> & {
  createdAt: string;
  outputs?: ConversationOutput[];
  timeline?: ConversationTimeline[];
  metrics?: AiMessageMetrics;
  plan?: AiMemoryMessage['plan'] | null;
  pendingPlan?: AiMemoryMessage['pendingPlan'] | null;
};

export type Conversation = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  agentConversationId?: string;
  messages: ConversationMessage[];
};

export type LocalConversation = Omit<Conversation, 'revision'> & { revision: number | null };
export type ConversationSnapshot = Pick<
  Conversation,
  'createdAt' | 'agentConversationId' | 'messages'
>;
export type ConversationScope = { site: string; userId: string; key: string };
export type PendingConversation = {
  snapshot: ConversationSnapshot;
  delete: boolean;
  conflict?: Conversation;
};
export type ConversationCache = {
  conversations: Record<string, LocalConversation>;
  pending: Record<string, PendingConversation>;
  selectedId: string | null;
  imported?: boolean;
};
export type ConversationIssue = 'load' | 'save' | 'conflict' | 'storage';
export type ConversationView = {
  scopeKey: string | null;
  conversations: LocalConversation[];
  selectedId: string | null;
  isLoading: boolean;
  issue?: ConversationIssue;
  hasPending: boolean;
  canKeepCopy: boolean;
  hasLegacy: boolean;
  canImportLegacy: boolean;
};
