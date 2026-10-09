import type {
  AiAgentClientState,
  AiAgentPhase,
  AiAgentToolProgressStatus,
  AiChatStreamHandlers,
  AiTokenUsage,
  AiUsagePhase,
} from '@/utils/aiApi';
import {
  getAiSourceKey,
  mergeAiTokenUsage,
  mergeAiTokenUsageByPhase,
  settleAiMessageTimeline,
  type AiMemoryMessage,
} from '@/state/aiChat';

export type AiRunLabels = {
  phase: (phase: AiAgentPhase) => string;
  toolStarted: (toolName: string) => string;
  toolStatus: (status: AiAgentToolProgressStatus) => string;
  toolFinished: (toolName: string) => string;
  sourcesFound: (count: number) => string;
  sourcesAdded: (added: number, total: number) => string;
  evidenceLimit: string;
  askFailed: string;
  streamInterrupted: string;
  streamTimeout: string;
  streamTruncated: string;
  fallbackNoAnswerWithSources: string;
  fallbackNoAnswerNoSources: string;
};

export type AiRunProgressState = {
  currentIsMore: boolean;
  evidenceExhausted?: boolean;
  receivedClarification: boolean;
  firstTokenTime?: number;
};

type AiRunHandlerContext = {
  assistantId: string;
  labels: AiRunLabels;
  progress: AiRunProgressState;
  startedAt: number;
  seenSourceIds: Set<string>;
  isActiveRun: (assistantId: string) => boolean;
  setMessagesForActiveRun: (
    assistantId: string,
    updater: (messages: AiMemoryMessage[]) => AiMemoryMessage[]
  ) => void;
  queueStreamDelta: (assistantId: string, text: string) => void;
  mergeAgentState: (
    state: Partial<AiAgentClientState>,
    options?: { replaceSeenSourceIds?: boolean }
  ) => void;
};

function updateTimeline(
  ctx: AiRunHandlerContext,
  item: {
    id: string;
    type: 'progress' | 'tool';
    phase?: AiAgentPhase;
    toolName?: string;
    toolStatus?: AiAgentToolProgressStatus;
    message: string;
    status?: 'running' | 'done' | 'error';
  }
) {
  if (!ctx.isActiveRun(ctx.assistantId)) return;
  const updatedAt = Date.now();
  ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
    prev.map((message) => {
      if (message.id !== ctx.assistantId) return message;
      const current = message.timeline || [];
      const existingIndex = current.findIndex((entry) => entry.id === item.id);
      const nextItem = {
        id: item.id,
        type: item.type,
        phase: item.phase,
        toolName: item.toolName,
        toolStatus: item.toolStatus,
        message: item.message,
        status: item.status || 'running',
        updatedAt,
      };
      const next =
        existingIndex >= 0
          ? current.map((entry, index) =>
              index === existingIndex ? { ...entry, ...nextItem } : entry
            )
          : [...current, nextItem];
      return { ...message, timeline: next.slice(-10) };
    })
  );
}

function addUsage(ctx: AiRunHandlerContext, usage: AiTokenUsage, phase: AiUsagePhase) {
  ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
    prev.map((message) =>
      message.id === ctx.assistantId
        ? {
            ...message,
            metrics: {
              ...message.metrics,
              usage: mergeAiTokenUsage(message.metrics?.usage, usage),
              usageByPhase: mergeAiTokenUsageByPhase(message.metrics?.usageByPhase, phase, usage),
            },
          }
        : message
    )
  );
}

export function createAiRunHandlers(ctx: AiRunHandlerContext): AiChatStreamHandlers {
  return {
    onRunStarted: (runId) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.mergeAgentState({ conversationId: runId });
    },
    onProgress: (phase) => {
      updateTimeline(ctx, {
        id: `progress-${phase}`,
        type: 'progress',
        phase,
        message:
          phase === 'answering' && ctx.progress.evidenceExhausted
            ? ctx.labels.evidenceLimit
            : ctx.labels.phase(phase),
      });
    },
    onToolStarted: (toolName) => {
      updateTimeline(ctx, {
        id: `tool-${toolName}`,
        type: 'tool',
        toolName,
        message: ctx.labels.toolStarted(toolName),
      });
    },
    onToolProgress: (toolName, status) => {
      updateTimeline(ctx, {
        id: `tool-${toolName}`,
        type: 'tool',
        toolName,
        toolStatus: status,
        message: ctx.labels.toolStatus(status),
      });
    },
    onToolFinished: (toolName) => {
      if (toolName === 'rote_search_notes') return;
      updateTimeline(ctx, {
        id: `tool-${toolName}`,
        type: 'tool',
        toolName,
        message: ctx.labels.toolFinished(toolName),
        status: 'done',
      });
    },
    onPlan: (plan) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.progress.currentIsMore = false;
      ctx.seenSourceIds.clear();
      ctx.mergeAgentState(
        { previousPlan: plan, seenSourceIds: [] },
        { replaceSeenSourceIds: true }
      );
      const planTime = performance.now() - ctx.startedAt;
      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) =>
          message.id === ctx.assistantId
            ? { ...message, plan, metrics: { ...message.metrics, planTime } }
            : message
        )
      );
    },
    onClarification: (clarification) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.progress.receivedClarification = true;
      const planTime = performance.now() - ctx.startedAt;

      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) =>
          message.id === ctx.assistantId
            ? settleAiMessageTimeline(
                {
                  ...message,
                  content: clarification.question,
                  plan: clarification.pendingPlan ?? undefined,
                  pendingPlan: clarification.pendingPlan ?? undefined,
                  clarification: true,
                  isStreaming: false,
                  metrics: {
                    ...message.metrics,
                    planTime,
                    totalTime: performance.now() - ctx.startedAt,
                  },
                },
                'done'
              )
            : message
        )
      );
    },
    onSources: (sources, retrieval) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.progress.evidenceExhausted = retrieval?.budgetExhausted;
      sources.forEach((source) => ctx.seenSourceIds.add(getAiSourceKey(source)));
      ctx.mergeAgentState(
        {
          seenSourceIds: Array.from(ctx.seenSourceIds),
        },
        { replaceSeenSourceIds: !ctx.progress.currentIsMore }
      );
      const sourcesTime = performance.now() - ctx.startedAt;
      updateTimeline(ctx, {
        id: 'tool-rote_search_notes',
        type: 'tool',
        toolName: 'rote_search_notes',
        message: retrieval?.budgetExhausted
          ? ctx.labels.evidenceLimit
          : retrieval
            ? ctx.labels.sourcesAdded(retrieval.addedCount, retrieval.totalCount)
            : ctx.labels.sourcesFound(sources.length),
        status: 'done',
      });
      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) =>
          message.id === ctx.assistantId
            ? { ...message, sources, retrieval, metrics: { ...message.metrics, sourcesTime } }
            : message
        )
      );
    },
    onThinking: (phase, text) => {
      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) =>
          message.id === ctx.assistantId
            ? {
                ...message,
                thinking: {
                  ...message.thinking,
                  [phase]: `${message.thinking?.[phase] || ''}${text}`,
                },
              }
            : message
        )
      );
    },
    onDelta: (text) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      if (!ctx.progress.firstTokenTime) {
        ctx.progress.firstTokenTime = performance.now() - ctx.startedAt;
        ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
          prev.map((message) =>
            message.id === ctx.assistantId
              ? {
                  ...message,
                  metrics: { ...message.metrics, firstTokenTime: ctx.progress.firstTokenTime },
                }
              : message
          )
        );
      }
      ctx.queueStreamDelta(ctx.assistantId, text);
    },
    onOutputDelta: (output) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.progress.firstTokenTime ??= performance.now() - ctx.startedAt;
      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) => {
          if (message.id !== ctx.assistantId) return message;
          const outputs = message.outputs || [];
          const existing = outputs.find((item) => item.outputId === output.outputId);
          const next = { ...output, text: `${existing?.text || ''}${output.text}` };
          return {
            ...message,
            content: next.text,
            outputs: existing
              ? outputs.map((item) => (item.outputId === output.outputId ? next : item))
              : [...outputs, next],
            metrics: { ...message.metrics, firstTokenTime: ctx.progress.firstTokenTime },
          };
        })
      );
    },
    onOutputFinished: (output) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      ctx.setMessagesForActiveRun(ctx.assistantId, (prev) =>
        prev.map((message) => {
          if (message.id !== ctx.assistantId) return message;
          const outputs = message.outputs?.map((item) =>
            item.outputId === output.outputId ? { ...item, kind: output.kind } : item
          );
          return {
            ...message,
            outputs,
            content: output.kind === 'process' ? '' : message.content,
          };
        })
      );
    },
    onUsage: (usage, phase) => {
      addUsage(ctx, usage, phase);
    },
    onStatePatch: (state) => {
      if (!ctx.isActiveRun(ctx.assistantId)) return;
      const nextState = ctx.progress.currentIsMore
        ? state
        : {
            ...state,
            seenSourceIds: Array.from(ctx.seenSourceIds),
          };
      ctx.mergeAgentState(nextState, { replaceSeenSourceIds: !ctx.progress.currentIsMore });
      if (ctx.progress.currentIsMore && state.seenSourceIds?.length) {
        state.seenSourceIds.forEach((id) => ctx.seenSourceIds.add(id));
      }
    },
  };
}
