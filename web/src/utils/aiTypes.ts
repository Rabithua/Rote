export type AiSourceType = 'rote' | 'article';

export interface AiStatus {
  enabled: boolean;
  vectorEnabled: boolean;
  publicExploreVectorEnabled: boolean;
  eligible: boolean;
  available: boolean;
  memoryAvailable?: boolean;
  chatAvailable?: boolean;
  chatAllowed?: boolean;
  chatProviderId?: string;
  chatModel?: string;
  chatMode?: 'disabled' | 'site' | 'local';
  memoryStats?: { roteCount: number; indexedRoteCount: number };
}

export type RetrievalSelection = 'relevance' | 'recent';
export type RetrievalDateField = 'createdAt' | 'updatedAt';
export type LifecycleScope = 'active' | 'archived' | 'all' | 'unspecified';
export type TaskStatusScope = 'open' | 'closed' | 'all' | 'unspecified';

export interface AiSemanticResult {
  id?: string;
  ownerId?: string;
  sourceType: AiSourceType;
  sourceId: string;
  chunkIndex?: number;
  text?: string;
  preview?: string;
  similarity: number;
  retrievalMode?: RetrievalSelection;
  metadata: {
    title?: string;
    tags?: string[];
    state?: string;
    archived?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
}

export type AiToolCallingProbeResult = {
  supported: boolean;
  message: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  rawContent?: string;
  error?: string;
};

export interface AiProviderTestResult {
  success: boolean;
  eligible?: boolean;
  chatAvailable?: boolean;
  vectorAvailable?: boolean;
  model?: string;
  latencyMs?: number;
  sample?: string;
  usage?: AiTokenUsage;
  toolCalling?: AiToolCallingProbeResult;
}

export type AiProviderTestProgressStep = 'site' | 'personal_remote' | 'local_chat' | 'tool_calling';
export type AiProviderTestProgressHandler = (step: AiProviderTestProgressStep) => void;

export interface NormalizedTimeRange {
  from: string;
  to: string;
  label: string;
}

export interface RetrievalScope {
  ownerId: string;
  query: string;
  tags: string[];
  excludeTags: string[];
  semanticScope: string[];
  sourceTypes: AiSourceType[];
  timeRange: NormalizedTimeRange | null;
  selection: RetrievalSelection;
  dateField: RetrievalDateField;
  lifecycleScope: LifecycleScope;
  taskStatusScope: TaskStatusScope;
  limit: number;
  cursor: string | null;
  excludeIds: string[];
}

export interface RetrievalSnippet {
  id: string;
  sourceType: AiSourceType;
  sourceId: string;
  title?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  retrievalMode?: RetrievalSelection;
  similarity: number;
  text: string;
}

export interface RetrievalToolResult {
  canonicalizedArgs: RetrievalScope;
  resultCount: number;
  topSnippets: RetrievalSnippet[];
  cursor: string | null;
  warnings: string[];
}

export interface PlannerDebugTrace {
  toolCalls: Array<{ step: number; name: string; args: unknown }>;
  canonicalizedArgs: RetrievalScope[];
  warnings: string[];
  probeCounts: number[];
  finishReason?: string;
  fallbackReason?: string;
  providerError?: string;
  toolError?: string;
}

export interface PlannerAgentDto {
  originalMessage: string;
  retrievalNeeded: boolean;
  scope: RetrievalScope | null;
  toolResult: RetrievalToolResult | null;
  clarification: { question: string; reason?: string } | null;
  debugTrace: PlannerDebugTrace;
}

export interface AiClarification {
  question: string;
  pendingPlan?: PlannerAgentDto | null;
}

export type AiAgentPhase =
  | 'understanding'
  | 'planning'
  | 'tool_calling'
  | 'retrieving'
  | 'reading'
  | 'answering';
export type AiAgentToolProgressStatus =
  | 'determining_scope'
  | 'retrieving_sources'
  | 'reading_source'
  | 'finding_related'
  | 'loading_tags';
export type AiUsagePhase = 'planning' | 'tool_decision' | 'answer';
export type AiThinkingPhase =
  | 'route_decision'
  | 'evidence_decision'
  | 'retrieval_planning'
  | 'answer';

export type AiTokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type AiStreamFailure = {
  code: string;
  message: string;
  runId?: string;
  retryable: boolean;
};

export interface AiClientRequestContext {
  nowIso: string;
  localDate: string;
  localDateTime: string;
  timeZone?: string;
  utcOffsetMinutes: number;
  locale?: string;
  calendar?: string;
}

export interface AiAgentClientState {
  conversationId?: string;
  previousPlan?: PlannerAgentDto | null;
  seenSourceIds?: string[];
  selectedContext?: {
    currentRoteId?: string;
    currentArticleId?: string;
    selectedSourceIds?: string[];
    selectedTags?: string[];
  } | null;
  clientContext?: AiClientRequestContext | null;
  stateVersion?: number;
}

export type AiChatStreamHandlers = {
  onRunStarted?: (runId: string) => void;
  onProgress?: (phase: AiAgentPhase) => void;
  onHeartbeat?: (heartbeat: { phase: AiAgentPhase; seq: number; timestamp: string }) => void;
  onToolStarted?: (toolName: string, args?: unknown) => void;
  onToolProgress?: (toolName: string, status: AiAgentToolProgressStatus) => void;
  onToolFinished?: (toolName: string, summary?: string) => void;
  onPlan?: (plan: PlannerAgentDto) => void;
  onClarification?: (clarification: AiClarification) => void;
  onSources?: (sources: AiSemanticResult[]) => void;
  onThinking?: (phase: AiThinkingPhase, text: string) => void;
  onDelta?: (text: string) => void;
  onStatePatch?: (state: Partial<AiAgentClientState>) => void;
  onUsage?: (usage: AiTokenUsage, phase: AiUsagePhase) => void;
  onDone?: () => void;
  onError?: (failure: AiStreamFailure) => void;
};

export type ClientAgentBootstrap = {
  systemPrompt: string;
  finalAnswerInstruction: string;
  tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  policy: {
    maxIterations: number;
    maxToolCalls: number;
    maxSources: number;
    maxSourceChars: number;
  };
};

export type ClientAgentToolResult = {
  observations: string[];
  displaySummary?: unknown;
  modelContent: string;
  sources: AiSemanticResult[];
  plan?: PlannerAgentDto;
  statePatch?: Partial<AiAgentClientState>;
  state: AiAgentClientState;
  sourceKeys: string[];
  sourceCharsUsed: number;
  clarification?: AiClarification;
};

export type AiChatPayload = {
  message: string;
  mode?: 'chat' | 'review' | 'organize';
  limit?: number;
  pendingPlan?: PlannerAgentDto | null;
  clarificationAnswer?: string;
  previousPlan?: PlannerAgentDto | null;
  excludeIds?: string[];
  history?: { role: 'user' | 'assistant'; content: string }[];
  state?: AiAgentClientState | null;
  clientContext?: AiClientRequestContext | null;
  debug?: boolean;
  enableThinking?: boolean;
};
