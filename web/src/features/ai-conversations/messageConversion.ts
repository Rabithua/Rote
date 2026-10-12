import { sanitizeAiChatMessages, type AiMemoryMessage, type AiOutputStatus } from '@/state/aiChat';
import type { AiAgentPhase, AiAgentToolProgressStatus, AiThinkingPhase } from '@/utils/aiTypes';
import type { ConversationMessage, ConversationTimeline } from './types';

export function messageCreatedAt(message: AiMemoryMessage, fallback: string): string {
  if (message.createdAt) return message.createdAt;
  const milliseconds = Number(message.id.match(/^(\d{13})-/)?.[1]);
  return milliseconds ? new Date(milliseconds).toISOString() : fallback;
}

function outputTimeline(id: string, status: AiOutputStatus, date: string): ConversationTimeline {
  const base = { id, updatedAt: date, status: 'done' as const };
  if (status.type === 'phase') return { ...base, type: 'progress', phase: status.phase };
  if (status.type === 'sources') {
    return {
      ...base,
      type: 'tool',
      toolName: 'rote_search_notes',
      retrieval: {
        foundCount: status.count,
        addedCount: status.added ?? status.count,
        totalCount: status.count,
        budgetExhausted: false,
      },
    };
  }
  if (status.type === 'evidence_limit') {
    return { ...base, type: 'tool', toolStatus: 'evidence_limit' };
  }
  if (status.type === 'tool_progress') {
    return { ...base, type: 'tool', toolStatus: status.status };
  }
  return { ...base, type: 'tool', toolName: status.toolName };
}

function presentationStatus(status: ConversationTimeline): AiOutputStatus {
  if (status.retrieval) {
    return {
      type: 'sources',
      count: status.retrieval.totalCount,
      added: status.retrieval.addedCount,
    };
  }
  if (status.toolStatus === 'evidence_limit') return { type: 'evidence_limit' };
  if (status.toolStatus) {
    return { type: 'tool_progress', status: status.toolStatus as AiAgentToolProgressStatus };
  }
  if (status.toolName) {
    return {
      type: status.status === 'running' ? 'tool_started' : 'tool_finished',
      toolName: status.toolName,
    };
  }
  return { type: 'phase', phase: (status.phase || 'answering') as AiAgentPhase };
}

export function serializeMessages(
  messages: AiMemoryMessage[],
  fallbackDate: string,
  interrupted: string
): ConversationMessage[] {
  return sanitizeAiChatMessages(messages, interrupted).map((message) => {
    const { isStreaming: _isStreaming, outputs, timeline, ...stable } = message;
    const createdAt = messageCreatedAt(message, fallbackDate);
    return {
      ...stable,
      createdAt,
      outputs: outputs?.map(({ outputId, status, canonicalStatus, ...output }) => ({
        ...output,
        id: outputId,
        status: canonicalStatus
          ? {
              ...canonicalStatus,
              status: canonicalStatus.status === 'running' ? 'error' : canonicalStatus.status,
            }
          : status
            ? outputTimeline(outputId, status, createdAt)
            : undefined,
      })),
      timeline: timeline?.map(({ updatedAt, canonicalRetrieval, ...item }) => ({
        ...item,
        updatedAt: new Date(updatedAt).toISOString(),
        retrieval: canonicalRetrieval,
      })),
    };
  });
}

export function deserializeMessages(messages: ConversationMessage[]): AiMemoryMessage[] {
  return messages.map(({ outputs, timeline, plan, pendingPlan, ...message }) => ({
    ...message,
    plan,
    pendingPlan,
    outputs: outputs?.map(({ id, phase, thinkingPhase, status, ...output }) => ({
      ...output,
      outputId: id,
      phase: phase as AiAgentPhase,
      thinkingPhase: thinkingPhase as AiThinkingPhase | undefined,
      status: status ? presentationStatus(status) : undefined,
      canonicalStatus: status,
    })),
    timeline: timeline?.map(({ updatedAt, phase, toolStatus, retrieval, message, ...item }) => ({
      ...item,
      phase: phase as AiAgentPhase | undefined,
      toolStatus: toolStatus as AiAgentToolProgressStatus | undefined,
      message,
      updatedAt: Date.parse(updatedAt),
      canonicalRetrieval: retrieval,
    })),
  }));
}
