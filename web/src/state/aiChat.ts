import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type {
  AiAgentPhase,
  AiAgentToolProgressStatus,
  AiThinkingPhase,
  AiTokenUsage,
  PlannerAgentDto,
  AiSemanticResult,
  AiUsagePhase,
} from '@/utils/aiApi';

export type AiMessageMetrics = {
  planTime?: number;
  sourcesTime?: number;
  firstTokenTime?: number;
  totalTime?: number;
  usage?: AiMessageTokenUsage;
  usageByPhase?: Partial<Record<AiUsagePhase, AiMessageTokenUsage>>;
};

export type AiMessageTokenUsage = AiTokenUsage;

export type AiMessageTimelineItem = {
  id: string;
  type: 'progress' | 'tool';
  phase?: AiAgentPhase;
  toolName?: string;
  toolStatus?: AiAgentToolProgressStatus;
  message: string;
  status: 'running' | 'done' | 'error';
  updatedAt: number;
};

export type AiMemoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSemanticResult[];
  plan?: PlannerAgentDto;
  pendingPlan?: PlannerAgentDto;
  clarification?: boolean;
  error?: boolean;
  errorDetail?: string;
  saved?: boolean;
  metrics?: AiMessageMetrics;
  thinking?: {
    [phase in AiThinkingPhase]?: string;
  };
  timeline?: AiMessageTimelineItem[];
  /** Transient — never persisted. */
  isStreaming?: boolean;
};

const AI_SOURCE_KEY_PATTERN = /^(rote|article):[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function sanitizeAiSourceKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string => typeof item === 'string' && AI_SOURCE_KEY_PATTERN.test(item)
        )
        .map((item) => item.toLowerCase())
    )
  ).slice(0, 500);
}

export function getAiSourceKey(source: AiSemanticResult): string {
  return `${source.sourceType}:${source.sourceId}`;
}

export function mergeAiTokenUsage(
  current: AiMessageTokenUsage | undefined,
  incoming: AiMessageTokenUsage
): AiMessageTokenUsage {
  return {
    prompt_tokens: (current?.prompt_tokens || 0) + (incoming.prompt_tokens || 0),
    completion_tokens: (current?.completion_tokens || 0) + (incoming.completion_tokens || 0),
    total_tokens: (current?.total_tokens || 0) + (incoming.total_tokens || 0),
  };
}

export function mergeAiTokenUsageByPhase(
  current: Partial<Record<AiUsagePhase, AiMessageTokenUsage>> | undefined,
  phase: AiUsagePhase,
  incoming: AiMessageTokenUsage
): Partial<Record<AiUsagePhase, AiMessageTokenUsage>> {
  return {
    ...(current || {}),
    [phase]: mergeAiTokenUsage(current?.[phase], incoming),
  };
}

export function settleAiMessageTimeline(
  message: AiMemoryMessage,
  status: 'done' | 'error'
): AiMemoryMessage {
  if (!message.timeline?.some((entry) => entry.status === 'running')) {
    return message;
  }

  return {
    ...message,
    timeline: message.timeline.map((entry) =>
      entry.status === 'running' ? { ...entry, status } : entry
    ),
  };
}

export function sanitizeAiChatMessages(
  messages: AiMemoryMessage[],
  interruptedContent: string
): AiMemoryMessage[] {
  let changed = false;
  const nextMessages = messages.map((message) => {
    let next = message;

    if (next.isStreaming) {
      changed = true;
      const { isStreaming: _isStreaming, ...stableMessage } = next;
      const wasInterruptedAssistant = stableMessage.role === 'assistant';
      next = {
        ...stableMessage,
        content: stableMessage.content,
        error: wasInterruptedAssistant ? true : stableMessage.error,
        errorDetail: wasInterruptedAssistant ? interruptedContent : stableMessage.errorDetail,
      };
    }

    if (next.timeline?.some((entry) => entry.status === 'running')) {
      changed = true;
      next = settleAiMessageTimeline(next, 'error');
    }

    return next;
  });

  return changed ? nextMessages : messages;
}

export function getLatestAiAssistantPlan(messages: AiMemoryMessage[]): PlannerAgentDto | null {
  return (
    [...messages].reverse().find((message) => message.role === 'assistant' && message.plan)?.plan ||
    null
  );
}

export function getCurrentAiAssistantSources(messages: AiMemoryMessage[]): AiSemanticResult[] {
  return [...messages].reverse().find((message) => message.role === 'assistant')?.sources || [];
}

export function getSeenSourceIdsForActiveAiPlan(messages: AiMemoryMessage[]): string[] {
  const ids: string[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    if (message.sources?.length) {
      ids.push(...sanitizeAiSourceKeys(message.sources.map(getAiSourceKey)));
    }

    if (message.plan) {
      break;
    }
  }

  return sanitizeAiSourceKeys(ids);
}

export const aiChatMessagesAtom = atomWithStorage<AiMemoryMessage[]>('aiChatMessages', []);

export type AiRunState = {
  isSending: boolean;
  assistantId?: string;
};

export const aiRunStateAtom = atom<AiRunState>({ isSending: false });
