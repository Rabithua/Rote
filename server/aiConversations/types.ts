import type { PlannerAgentDto } from '../utils/dbMethods/ai/types';

/** Canonical v1 history DTO. Dates are ISO8601 UTC; durations are milliseconds. */
export type AiConversationSource = {
  id?: string;
  ownerId?: string;
  sourceType: 'rote' | 'article';
  sourceId: string;
  chunkIndex?: number;
  text?: string;
  preview?: string;
  similarity: number;
  retrievalMode?: 'relevance' | 'recent';
  metadata: {
    title?: string;
    tags?: string[];
    state?: string;
    archived?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
};

export type AiConversationRetrieval = {
  foundCount: number;
  addedCount: number;
  totalCount: number;
  budgetExhausted: boolean;
};

export type AiConversationTimelineItem = {
  id: string;
  type: 'progress' | 'tool';
  phase?: string;
  toolName?: string;
  toolStatus?: string;
  message?: string;
  status: 'running' | 'done' | 'error';
  updatedAt: string;
  retrieval?: AiConversationRetrieval;
};

export type AiConversationOutput = {
  id: string;
  phase: string;
  text?: string;
  thinking?: string;
  thinkingPhase?: string;
  kind?: 'process' | 'answer';
  status?: AiConversationTimelineItem;
};

export type AiConversationTokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type AiConversationMetrics = {
  planTime?: number;
  sourcesTime?: number;
  firstTokenTime?: number;
  totalTime?: number;
  usage?: AiConversationTokenUsage;
  usageByPhase?: Partial<Record<'planning' | 'tool_decision' | 'answer', AiConversationTokenUsage>>;
};

export type AiConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  error?: boolean;
  errorDetail?: string;
  clarification?: boolean;
  sources?: AiConversationSource[];
  retrieval?: AiConversationRetrieval;
  plan?: PlannerAgentDto | null;
  pendingPlan?: PlannerAgentDto | null;
  thinking?: Record<string, string>;
  outputs?: AiConversationOutput[];
  timeline?: AiConversationTimelineItem[];
  metrics?: AiConversationMetrics;
  saved?: boolean;
};

export type AiConversationWrite = {
  baseRevision: number | null;
  createdAt: string;
  agentConversationId?: string;
  messages: AiConversationMessage[];
};

export type AiConversation = Omit<AiConversationWrite, 'baseRevision'> & {
  id: string;
  revision: number;
  updatedAt: string;
  deletedAt: string | null;
};
