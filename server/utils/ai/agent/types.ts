import type { AiConfig } from '../../../types/config';
import type { ChatCompletionUsage, ChatMessage, ChatToolCall, ChatToolDefinition } from '../client';
import type { PlannerAgentDto, SemanticSearchResult } from '../../dbMethods/ai';

export type RoteAgentMode = 'chat' | 'review' | 'organize';

export type RoteAgentPhase =
  | 'understanding'
  | 'planning'
  | 'tool_calling'
  | 'retrieving'
  | 'reading'
  | 'answering';

export type RoteAgentToolProgressStatus =
  | 'determining_scope'
  | 'retrieving_sources'
  | 'reading_source'
  | 'finding_related'
  | 'loading_tags';

export type RoteAgentUsagePhase = 'planning' | 'tool_decision' | 'answer';
export type RoteAgentThinkingPhase =
  | 'route_decision'
  | 'evidence_decision'
  | 'retrieval_planning'
  | 'answer';

export type RoteAgentClientState = {
  conversationId?: string;
  previousPlan?: PlannerAgentDto | null;
  seenSourceIds?: string[];
  selectedContext?: {
    currentRoteId?: string;
    currentArticleId?: string;
    selectedSourceIds?: string[];
    selectedTags?: string[];
  } | null;
  clientContext?: RoteAgentClientContext | null;
  stateVersion?: number;
};

export type RoteAgentClientContext = {
  nowIso?: string;
  localDate?: string;
  localDateTime?: string;
  timeZone?: string;
  utcOffsetMinutes?: number;
  locale?: string;
  calendar?: string;
};

export type RoteAgentRequest = {
  message: string;
  mode?: RoteAgentMode;
  history?: { role: 'user' | 'assistant'; content: string }[];
  state?: RoteAgentClientState | null;
  selectedContext?: RoteAgentClientState['selectedContext'];
  clientContext?: RoteAgentClientContext | null;
  debug?: boolean;
  limit?: number;
  previousPlan?: PlannerAgentDto | null;
  excludeIds?: string[];
  pendingPlan?: PlannerAgentDto | null;
  clarificationAnswer?: string;
  enableThinking?: boolean;
};

export type RoteAgentPolicy = {
  maxIterations: number;
  maxToolCalls: number;
  maxSources: number;
  maxSourceChars: number;
  heartbeatMs: number;
  allowWrite: boolean;
};

export type RoteAgentStreamEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'skill_selected'; skillName: string }
  | { type: 'progress'; phase: RoteAgentPhase }
  | { type: 'heartbeat'; phase: RoteAgentPhase; seq: number; timestamp: string }
  | { type: 'tool_started'; toolName: string; args?: unknown }
  | { type: 'tool_progress'; toolName: string; status: RoteAgentToolProgressStatus }
  | { type: 'tool_finished'; toolName: string; summary?: unknown }
  | { type: 'sources'; sources: SemanticSearchResult[] }
  | { type: 'plan'; plan: PlannerAgentDto }
  | { type: 'clarification'; question: string; pendingPlan?: PlannerAgentDto | null }
  | { type: 'thinking'; phase: RoteAgentThinkingPhase; text: string }
  | { type: 'delta'; text: string }
  | { type: 'state_patch'; state: Partial<RoteAgentClientState> }
  | { type: 'usage'; phase: RoteAgentUsagePhase; usage: ChatCompletionUsage }
  | { type: 'done' }
  | {
      type: 'error';
      message: string;
      code?: string;
      runId?: string;
      retryable?: boolean;
    };

export type RoteAgentEmitter = (event: RoteAgentStreamEvent) => Promise<void> | void;

export type RoteAgentSourceRegistration = {
  index: number;
  source: SemanticSearchResult;
  isNew: boolean;
};

export type RoteAgentSourceBudgetSnapshot = {
  sourceCount: number;
  maxSources: number;
  sourceCharsUsed: number;
  maxSourceChars: number;
  remainingSources: number;
  remainingSourceChars: number;
};

export type RoteAgentContext = {
  userId: string;
  requestId: string;
  request: RoteAgentRequest;
  config: AiConfig;
  mode: RoteAgentMode;
  policy: RoteAgentPolicy;
  state: RoteAgentClientState;
  emit: RoteAgentEmitter;
  registerSources: (sources: SemanticSearchResult[]) => RoteAgentSourceRegistration[];
  consumeSourceText: (value: string, requestedChars?: number) => string;
  getSourceBudget: () => RoteAgentSourceBudgetSnapshot;
  getSources: () => SemanticSearchResult[];
};

export type RoteAgentToolResult = {
  observations: string[];
  displaySummary?: unknown;
  modelContent: string;
  sources?: SemanticSearchResult[];
  plan?: PlannerAgentDto;
  statePatch?: Partial<RoteAgentClientState>;
  clarification?: { question: string; pendingPlan?: PlannerAgentDto | null };
};

export type RoteAgentTool = {
  definition: ChatToolDefinition;
  execute: (
    args: unknown,
    ctx: RoteAgentContext,
    call: ChatToolCall
  ) => Promise<RoteAgentToolResult>;
};

export class AgentToolCallingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentToolCallingUnavailableError';
  }
}

export function isAgentToolCallingUnavailableError(
  error: unknown
): error is AgentToolCallingUnavailableError {
  return error instanceof AgentToolCallingUnavailableError;
}

export const DEFAULT_AGENT_POLICY: RoteAgentPolicy = {
  maxIterations: 4,
  maxToolCalls: 8,
  maxSources: 20,
  maxSourceChars: 12_000,
  heartbeatMs: 2_000,
  allowWrite: false,
};

export type { ChatMessage };
