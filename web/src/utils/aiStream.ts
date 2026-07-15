import type {
  AiAgentClientState,
  AiAgentPhase,
  AiAgentToolProgressStatus,
  AiChatStreamHandlers,
  AiClarification,
  AiSemanticResult,
  AiStreamFailure,
  AiThinkingPhase,
  AiTokenUsage,
  AiUsagePhase,
  PlannerAgentDto,
} from './aiTypes';

export const DEFAULT_AI_STREAM_IDLE_TIMEOUT_MS = 60_000;
const STREAM_TIMEOUT_CODE = 'ai_stream_timeout';
const STREAM_INCOMPLETE_CODE = 'ai_stream_incomplete';
const AGENT_FAILED_CODE = 'ai_agent_failed';

export class AiStreamError extends Error {
  readonly code: string;
  readonly runId?: string;
  readonly retryable: boolean;

  constructor(failure: AiStreamFailure) {
    super(failure.message);
    this.name = 'AiStreamError';
    this.code = failure.code;
    this.runId = failure.runId;
    this.retryable = failure.retryable;
  }
}

export function isAiStreamError(error: unknown): error is AiStreamError {
  return error instanceof AiStreamError;
}

export function parseAiSseEvent(block: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  });
  if (dataLines.length === 0) return null;
  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}

function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      const error = new AiStreamError({
        code: STREAM_TIMEOUT_CODE,
        message: STREAM_TIMEOUT_CODE,
        retryable: true,
      });
      reader.cancel(error).then(
        () => reject(error),
        () => reject(error)
      );
    }, idleTimeoutMs);

    reader.read().then(
      (result) => {
        if (timedOut) return;
        window.clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        if (timedOut) return;
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function toStreamFailure(data: unknown): AiStreamFailure {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const code = typeof raw.code === 'string' ? raw.code : AGENT_FAILED_CODE;
  return {
    code,
    message: typeof raw.message === 'string' ? raw.message : code,
    runId: typeof raw.runId === 'string' ? raw.runId : undefined,
    retryable: raw.retryable !== false,
  };
}

export async function readAiStreamResponse(
  response: Response,
  handlers: AiChatStreamHandlers,
  options: { idleTimeoutMs?: number } = {}
): Promise<void> {
  if (!response.body) throw new Error('Streaming response is not supported in this browser');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const idleTimeoutMs = Math.max(1, options.idleTimeoutMs ?? DEFAULT_AI_STREAM_IDLE_TIMEOUT_MS);
  let buffer = '';
  let doneReceived = false;

  const dispatch = (block: string) => {
    const parsed = parseAiSseEvent(block);
    if (!parsed) return;

    if (parsed.event === 'run_started') {
      const runId = (parsed.data as { runId?: string })?.runId;
      if (runId) handlers.onRunStarted?.(runId);
    } else if (parsed.event === 'progress') {
      const data = parsed.data as { phase?: AiAgentPhase };
      if (data.phase) handlers.onProgress?.(data.phase);
    } else if (parsed.event === 'heartbeat') {
      const data = parsed.data as { phase?: AiAgentPhase; seq?: number; timestamp?: string };
      if (data.phase && typeof data.seq === 'number' && typeof data.timestamp === 'string') {
        handlers.onHeartbeat?.({ phase: data.phase, seq: data.seq, timestamp: data.timestamp });
      }
    } else if (parsed.event === 'tool_started') {
      const data = parsed.data as { toolName?: string; args?: unknown };
      if (data.toolName) handlers.onToolStarted?.(data.toolName, data.args);
    } else if (parsed.event === 'tool_progress') {
      const data = parsed.data as { toolName?: string; status?: AiAgentToolProgressStatus };
      if (data.toolName && data.status) handlers.onToolProgress?.(data.toolName, data.status);
    } else if (parsed.event === 'tool_finished') {
      const data = parsed.data as { toolName?: string; summary?: string };
      if (data.toolName) handlers.onToolFinished?.(data.toolName, data.summary);
    } else if (parsed.event === 'plan') {
      const plan = (parsed.data as { plan?: PlannerAgentDto })?.plan;
      if (plan) handlers.onPlan?.(plan);
    } else if (parsed.event === 'clarification') {
      const clarification = parsed.data as AiClarification;
      if (clarification?.question) handlers.onClarification?.(clarification);
    } else if (parsed.event === 'sources') {
      const sources = (parsed.data as { sources?: AiSemanticResult[] })?.sources;
      handlers.onSources?.(Array.isArray(sources) ? sources : []);
    } else if (parsed.event === 'thinking') {
      const data = parsed.data as { phase?: AiThinkingPhase; text?: string };
      if (
        (data.phase === 'route_decision' ||
          data.phase === 'evidence_decision' ||
          data.phase === 'retrieval_planning' ||
          data.phase === 'answer') &&
        typeof data.text === 'string'
      ) {
        handlers.onThinking?.(data.phase, data.text);
      }
    } else if (parsed.event === 'delta') {
      const text = (parsed.data as { text?: string })?.text;
      if (typeof text === 'string') handlers.onDelta?.(text);
    } else if (parsed.event === 'state_patch') {
      const state = (parsed.data as { state?: Partial<AiAgentClientState> })?.state;
      if (state) handlers.onStatePatch?.(state);
    } else if (parsed.event === 'usage') {
      const data = parsed.data as { phase?: AiUsagePhase; usage?: Partial<AiTokenUsage> };
      const rawUsage = data.usage;
      if (
        data.phase &&
        rawUsage &&
        typeof rawUsage.prompt_tokens === 'number' &&
        typeof rawUsage.completion_tokens === 'number' &&
        typeof rawUsage.total_tokens === 'number'
      ) {
        handlers.onUsage?.(
          {
            prompt_tokens: rawUsage.prompt_tokens,
            completion_tokens: rawUsage.completion_tokens,
            total_tokens: rawUsage.total_tokens,
          },
          data.phase
        );
      }
    } else if (parsed.event === 'done') {
      if (!doneReceived) {
        doneReceived = true;
        handlers.onDone?.();
      }
    } else if (parsed.event === 'error') {
      const failure = toStreamFailure(parsed.data);
      handlers.onError?.(failure);
      throw new AiStreamError(failure);
    }
  };

  try {
    while (!doneReceived) {
      const { done, value } = await readWithIdleTimeout(reader, idleTimeoutMs);
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatch(block);
        boundary = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (!doneReceived && tail) dispatch(tail);
    if (!doneReceived) {
      throw new AiStreamError({
        code: STREAM_INCOMPLETE_CODE,
        message: STREAM_INCOMPLETE_CODE,
        retryable: true,
      });
    }
  } finally {
    reader.releaseLock();
  }
}
