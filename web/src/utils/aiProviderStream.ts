import { AiStreamError } from './aiStream';

export const DEFAULT_PERSONAL_AI_REQUEST_TIMEOUT_MS = 120_000;
export const DEFAULT_PERSONAL_AI_IDLE_TIMEOUT_MS = 45_000;
const PROVIDER_TIMEOUT_CODE = 'ai_provider_timeout';
const PROVIDER_TRUNCATED_CODE = 'ai_provider_output_truncated';
const PROVIDER_INCOMPLETE_CODE = 'ai_provider_stream_incomplete';

type PersonalAiStreamControl = {
  signal: AbortSignal;
  read: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs?: number
  ) => Promise<ReadableStreamReadResult<Uint8Array>>;
  normalizeError: (error: unknown) => unknown;
  cleanup: () => void;
};

function signalReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
}

export function createPersonalAiStreamControl(params: {
  signal?: AbortSignal;
  requestTimeoutMs?: number;
  idleTimeoutMs?: number;
}): PersonalAiStreamControl {
  const controller = new AbortController();
  const requestTimeoutMs = Math.max(
    1,
    params.requestTimeoutMs ?? DEFAULT_PERSONAL_AI_REQUEST_TIMEOUT_MS
  );
  const idleTimeoutMs = Math.max(1, params.idleTimeoutMs ?? DEFAULT_PERSONAL_AI_IDLE_TIMEOUT_MS);
  let abortReason: unknown;

  const abort = (reason: unknown) => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    controller.abort(reason);
  };
  const onExternalAbort = () => {
    if (params.signal) abort(signalReason(params.signal));
  };

  if (params.signal?.aborted) onExternalAbort();
  else params.signal?.addEventListener('abort', onExternalAbort, { once: true });

  const requestTimer = window.setTimeout(() => {
    abort(
      new AiStreamError({
        code: PROVIDER_TIMEOUT_CODE,
        message: PROVIDER_TIMEOUT_CODE,
        retryable: true,
      })
    );
  }, requestTimeoutMs);

  return {
    signal: controller.signal,
    read: (reader, timeoutMs) =>
      new Promise((resolve, reject) => {
        let timedOut = false;
        const readTimeoutMs = Math.max(1, timeoutMs ?? idleTimeoutMs);
        const idleTimer = window.setTimeout(() => {
          timedOut = true;
          const error = new AiStreamError({
            code: PROVIDER_TIMEOUT_CODE,
            message: PROVIDER_TIMEOUT_CODE,
            retryable: true,
          });
          abort(error);
          reader.cancel(error).then(
            () => reject(error),
            () => reject(error)
          );
        }, readTimeoutMs);
        reader.read().then(
          (result) => {
            if (timedOut) return;
            window.clearTimeout(idleTimer);
            resolve(result);
          },
          (error) => {
            if (timedOut) return;
            window.clearTimeout(idleTimer);
            reject(abortReason || error);
          }
        );
      }),
    normalizeError: (error) => abortReason || error,
    cleanup: () => {
      window.clearTimeout(requestTimer);
      params.signal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

const VALID_FINISH_REASONS = new Set(['stop', 'tool_calls', 'function_call']);
const TRUNCATED_FINISH_REASONS = new Set(['length', 'content_filter']);

export function assertPersonalAiFinishReason(reason: string | null): void {
  if (reason && TRUNCATED_FINISH_REASONS.has(reason)) {
    throw new AiStreamError({
      code: PROVIDER_TRUNCATED_CODE,
      message: PROVIDER_TRUNCATED_CODE,
      retryable: true,
    });
  }
}

export function assertPersonalAiStreamComplete(params: {
  doneReceived: boolean;
  finishReason: string | null;
}): void {
  assertPersonalAiFinishReason(params.finishReason);
  if (
    params.doneReceived ||
    (params.finishReason && VALID_FINISH_REASONS.has(params.finishReason))
  ) {
    return;
  }
  throw new AiStreamError({
    code: PROVIDER_INCOMPLETE_CODE,
    message: PROVIDER_INCOMPLETE_CODE,
    retryable: true,
  });
}
