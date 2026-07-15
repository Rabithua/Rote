import { getDefaultStore } from 'jotai';
import { toast } from 'sonner';
import { aiAgentStream, aiChatStream, type AiAgentClientState } from '@/utils/aiApi';
import { isAiStreamError } from '@/utils/aiStream';
import type { PersonalAiProviderConfig, PersonalAiMode } from '@/state/localAi';
import { localAiAgentStream } from '@/utils/localAiAgent';
import {
  createAiRunHandlers,
  type AiRunLabels,
  type AiRunProgressState,
} from '@/state/aiRunHandlers';
import {
  aiChatMessagesAtom,
  aiRunStateAtom,
  getLatestAiAssistantPlan,
  getSeenSourceIdsForActiveAiPlan,
  sanitizeAiSourceKeys,
  settleAiMessageTimeline,
  type AiMemoryMessage,
} from '@/state/aiChat';

type ActiveStream = {
  id: string;
  content: string;
  targetContent: string;
  frame: number | null;
  done: boolean;
  drainResolver?: () => void;
};

type ActiveRun = {
  assistantId: string;
  controller: AbortController;
};

type StartAiRunParams = {
  question: string;
  messages: AiMemoryMessage[];
  pendingPlan: AiMemoryMessage['pendingPlan'] | null;
  ignorePendingPlan?: boolean;
  unavailable: boolean;
  mode: PersonalAiMode;
  personalConfig?: PersonalAiProviderConfig;
  toolsAvailable?: boolean;
  enableThinking?: boolean;
  labels: AiRunLabels;
};

const store = getDefaultStore();

let activeRun: ActiveRun | null = null;
let activeStream: ActiveStream | null = null;
let isSending = false;
let seenSourceIds = new Set<string>();
let agentState: AiAgentClientState = {
  conversationId: createAiMessageId(),
  seenSourceIds: [],
  stateVersion: 1,
};

export function createAiMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStreamRevealSize(backlog: number) {
  if (backlog > 1200) return 240;
  if (backlog > 500) return 160;
  return 80;
}

export function isAiRunActive() {
  return isSending && !!activeRun;
}

function setRunState(next: { isSending: boolean; assistantId?: string }) {
  isSending = next.isSending;
  store.set(aiRunStateAtom, next);
}

function isActiveRun(assistantId: string) {
  return activeRun?.assistantId === assistantId;
}

function setMessagesForActiveRun(
  assistantId: string,
  updater: (messages: AiMemoryMessage[]) => AiMemoryMessage[]
) {
  if (!isActiveRun(assistantId)) return;
  store.set(aiChatMessagesAtom, updater);
}

function flushStreamContent(assistantId: string, options: { force?: boolean } = {}) {
  if (!isActiveRun(assistantId)) return;
  const stream = activeStream;
  if (!stream || stream.id !== assistantId) return;

  stream.frame = null;
  const backlog = stream.targetContent.length - stream.content.length;
  if (options.force) {
    stream.content = stream.targetContent;
  } else if (backlog > 0) {
    stream.content = stream.targetContent.slice(
      0,
      stream.content.length + getStreamRevealSize(backlog)
    );
  }

  setMessagesForActiveRun(assistantId, (prev) =>
    prev.map((message) =>
      message.id === assistantId ? { ...message, content: stream.content } : message
    )
  );

  if (!options.force && stream.content.length < stream.targetContent.length) {
    stream.frame = window.requestAnimationFrame(() => flushStreamContent(assistantId));
    return;
  }

  if (stream.done) {
    stream.drainResolver?.();
    stream.drainResolver = undefined;
  }
}

function queueStreamDelta(assistantId: string, text: string) {
  if (!isActiveRun(assistantId)) return;
  const stream = activeStream;
  if (!stream || stream.id !== assistantId) return;

  stream.targetContent += text;
  if (stream.frame === null) {
    stream.frame = window.requestAnimationFrame(() => flushStreamContent(assistantId));
  }
}

function drainStreamContent(assistantId: string): Promise<void> {
  if (!isActiveRun(assistantId)) return Promise.resolve();
  const stream = activeStream;
  if (!stream || stream.id !== assistantId) return Promise.resolve();

  stream.done = true;
  if (stream.content.length >= stream.targetContent.length) return Promise.resolve();

  if (document.visibilityState !== 'visible') {
    flushStreamContent(assistantId, { force: true });
    return Promise.resolve();
  }

  if (stream.frame === null) {
    stream.frame = window.requestAnimationFrame(() => flushStreamContent(assistantId));
  }
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      flushStreamContent(assistantId, { force: true });
      if (stream.drainResolver === finish) {
        stream.drainResolver = undefined;
      }
      resolve();
    };
    stream.drainResolver = finish;
    window.setTimeout(finish, 3000);
  });
}

function mergeAgentState(
  state: Partial<AiAgentClientState>,
  options: { replaceSeenSourceIds?: boolean } = {}
) {
  const previous = agentState;
  const incomingSeenSourceIds = sanitizeAiSourceKeys(state.seenSourceIds);
  const nextSeenSourceIds = options.replaceSeenSourceIds
    ? new Set(incomingSeenSourceIds)
    : new Set([...sanitizeAiSourceKeys(previous.seenSourceIds), ...incomingSeenSourceIds]);
  agentState = {
    ...previous,
    ...state,
    seenSourceIds: Array.from(nextSeenSourceIds).slice(0, 500),
  };
}

export function syncAiRunStateFromMessages(messages: AiMemoryMessage[]) {
  if (isSending) return;
  const nextSeenSourceIds = getSeenSourceIdsForActiveAiPlan(messages);
  seenSourceIds = new Set(nextSeenSourceIds);
  agentState = {
    ...agentState,
    previousPlan: getLatestAiAssistantPlan(messages),
    seenSourceIds: nextSeenSourceIds,
    stateVersion: 1,
  };
}

export function clearAiRun() {
  activeRun?.controller.abort();
  if (activeStream?.frame !== null && activeStream?.frame !== undefined) {
    window.cancelAnimationFrame(activeStream.frame);
  }
  activeRun = null;
  activeStream = null;
  seenSourceIds.clear();
  agentState = {
    conversationId: createAiMessageId(),
    seenSourceIds: [],
    stateVersion: 1,
  };
  setRunState({ isSending: false });
  store.set(aiChatMessagesAtom, []);
}

export function getAiRunFailureMessage(error: unknown, labels: AiRunLabels): string {
  const code = isAiStreamError(error) ? error.code : undefined;
  if (code === 'error_no_answer_with_sources') return labels.fallbackNoAnswerWithSources;
  if (code === 'error_no_answer_no_sources') return labels.fallbackNoAnswerNoSources;
  if (code === 'ai_stream_timeout' || code === 'ai_provider_timeout') {
    return labels.streamTimeout;
  }
  if (code === 'ai_provider_output_truncated') return labels.streamTruncated;
  if (code === 'ai_stream_incomplete' || code === 'ai_provider_stream_incomplete') {
    return labels.streamInterrupted;
  }

  const message = error instanceof Error ? error.message : '';
  if (message === 'error_no_answer_with_sources') return labels.fallbackNoAnswerWithSources;
  if (message === 'error_no_answer_no_sources') return labels.fallbackNoAnswerNoSources;
  return labels.askFailed;
}

export async function startAiRun(params: StartAiRunParams): Promise<boolean> {
  const question = params.question.trim();
  if (!question || isSending || params.unavailable) return false;

  const validHistory = params.messages
    .filter((message) => !message.error && !message.isStreaming && message.content)
    .map((message) => ({ role: message.role, content: message.content }))
    .slice(-6);

  const activePendingPlan = params.ignorePendingPlan ? null : params.pendingPlan;
  const assistantId = createAiMessageId();
  const controller = new AbortController();
  const progress: AiRunProgressState = {
    currentIsMore: false,
    receivedClarification: false,
  };
  const start = performance.now();

  activeRun = { assistantId, controller };
  activeStream = {
    id: assistantId,
    content: '',
    targetContent: '',
    frame: null,
    done: false,
  };
  setRunState({ isSending: true, assistantId });

  store.set(aiChatMessagesAtom, (prev) => [
    ...prev,
    {
      id: createAiMessageId(),
      role: 'user',
      content: question,
    },
    {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      isStreaming: true,
    },
  ]);

  try {
    const previousPlan = params.ignorePendingPlan
      ? null
      : getLatestAiAssistantPlan(params.messages);
    const excludeIds = seenSourceIds.size > 0 ? Array.from(seenSourceIds) : undefined;
    const isPersonalAgent = params.mode === 'personal';

    if (isPersonalAgent && !params.personalConfig?.enabled) {
      throw new Error('Personal AI is not enabled');
    }

    const agentPayload = {
      message: question,
      pendingPlan: activePendingPlan,
      clarificationAnswer: activePendingPlan ? question : undefined,
      previousPlan,
      excludeIds,
      history: validHistory.length > 0 ? validHistory : undefined,
      enableThinking: params.enableThinking === true,
      state: {
        ...agentState,
        previousPlan,
        seenSourceIds: excludeIds,
        stateVersion: 1,
      },
    };

    const agentHandlers = createAiRunHandlers({
      assistantId,
      labels: params.labels,
      progress,
      startedAt: start,
      seenSourceIds,
      isActiveRun,
      setMessagesForActiveRun,
      queueStreamDelta,
      mergeAgentState,
    });

    if (isPersonalAgent) {
      await localAiAgentStream({
        config: params.personalConfig!,
        payload: agentPayload,
        handlers: agentHandlers,
        toolsAvailable: params.toolsAvailable === true,
        enableThinking: params.enableThinking === true,
        signal: controller.signal,
      });
    } else if (params.toolsAvailable === true) {
      await aiAgentStream(agentPayload, agentHandlers, controller.signal);
    } else {
      await aiChatStream(agentPayload, agentHandlers, controller.signal);
    }

    if (!progress.receivedClarification) {
      await drainStreamContent(assistantId);
    }
    setMessagesForActiveRun(assistantId, (prev) => {
      const totalTime = performance.now() - start;
      return prev.map((message) =>
        message.id === assistantId
          ? settleAiMessageTimeline(
              {
                ...message,
                isStreaming: false,
                pendingPlan: progress.receivedClarification ? message.pendingPlan : undefined,
                metrics: { ...message.metrics, totalTime },
              },
              'done'
            )
          : message
      );
    });
  } catch (error: any) {
    const aborted = controller.signal.aborted || error?.name === 'AbortError';
    if (aborted) return true;

    const fallbackMessage = getAiRunFailureMessage(error, params.labels);
    const streamContent = activeStream?.targetContent || activeStream?.content || '';
    flushStreamContent(assistantId, { force: true });
    setMessagesForActiveRun(assistantId, (prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? settleAiMessageTimeline(
              {
                ...message,
                content: streamContent,
                error: true,
                errorDetail: fallbackMessage,
                isStreaming: false,
                metrics: {
                  ...message.metrics,
                  totalTime: performance.now() - start,
                },
              },
              'error'
            )
          : message
      )
    );
    if (streamContent) {
      toast.error(fallbackMessage);
    }
  } finally {
    const finishingActiveRun = activeRun?.assistantId === assistantId;
    if (activeStream?.id === assistantId && activeStream.frame !== null) {
      window.cancelAnimationFrame(activeStream.frame);
    }
    if (activeStream?.id === assistantId) {
      activeStream = null;
    }
    if (finishingActiveRun) {
      activeRun = null;
      setRunState({ isSending: false });
    }
  }

  return true;
}
