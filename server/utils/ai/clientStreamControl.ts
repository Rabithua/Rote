import type { ChatCompletionOptions } from './clientShared';

export const DEFAULT_AI_PROVIDER_REQUEST_TIMEOUT_MS = 120_000;
export const DEFAULT_AI_PROVIDER_IDLE_TIMEOUT_MS = 45_000;

export type AiProviderStreamErrorCode =
  | 'ai_provider_stream_incomplete'
  | 'ai_provider_output_truncated'
  | 'ai_provider_timeout';

export class AiProviderStreamError extends Error {
  readonly code: AiProviderStreamErrorCode;
  readonly retryable = true;

  constructor(code: AiProviderStreamErrorCode, message: string) {
    super(message);
    this.name = 'AiProviderStreamError';
    this.code = code;
  }
}

export function isAiProviderStreamError(error: unknown): error is AiProviderStreamError {
  return error instanceof AiProviderStreamError;
}

type ProviderStreamControl = {
  signal: AbortSignal;
  read: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs?: number
  ) => Promise<ReadableStreamReadResult<Uint8Array>>;
  normalizeError: (error: unknown) => unknown;
  cleanup: () => void;
};

function abortErrorFromSignal(signal: AbortSignal): unknown {
  if (signal.reason !== undefined) return signal.reason;
  return new DOMException('The operation was aborted', 'AbortError');
}

export function createProviderStreamControl(options: ChatCompletionOptions): ProviderStreamControl {
  const controller = new AbortController();
  const requestTimeoutMs = Math.max(
    1,
    options.requestTimeoutMs ?? DEFAULT_AI_PROVIDER_REQUEST_TIMEOUT_MS
  );
  const idleTimeoutMs = Math.max(1, options.idleTimeoutMs ?? DEFAULT_AI_PROVIDER_IDLE_TIMEOUT_MS);
  let abortReason: unknown;

  const abort = (reason: unknown) => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    controller.abort(reason);
  };

  const onExternalAbort = () => {
    if (options.signal) abort(abortErrorFromSignal(options.signal));
  };

  if (options.signal?.aborted) {
    onExternalAbort();
  } else {
    options.signal?.addEventListener('abort', onExternalAbort, { once: true });
  }

  const requestTimer = setTimeout(() => {
    abort(
      new AiProviderStreamError(
        'ai_provider_timeout',
        `AI provider request exceeded ${requestTimeoutMs}ms`
      )
    );
  }, requestTimeoutMs);

  return {
    signal: controller.signal,
    read: (reader, timeoutMs) =>
      new Promise((resolve, reject) => {
        let timedOut = false;
        const readTimeoutMs = Math.max(1, timeoutMs ?? idleTimeoutMs);
        const idleTimer = setTimeout(() => {
          timedOut = true;
          const error = new AiProviderStreamError(
            'ai_provider_timeout',
            `AI provider stream was idle for ${readTimeoutMs}ms`
          );
          abort(error);
          reader.cancel(error).then(
            () => reject(error),
            () => reject(error)
          );
        }, readTimeoutMs);

        reader.read().then(
          (result) => {
            if (timedOut) return;
            clearTimeout(idleTimer);
            resolve(result);
          },
          (error) => {
            if (timedOut) return;
            clearTimeout(idleTimer);
            reject(abortReason || error);
          }
        );
      }),
    normalizeError: (error) => abortReason || error,
    cleanup: () => {
      clearTimeout(requestTimer);
      options.signal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

const VALID_FINISH_REASONS = new Set(['stop', 'tool_calls', 'function_call']);
const TRUNCATED_FINISH_REASONS = new Set(['length', 'content_filter']);

export function readProviderFinishReason(chunk: unknown): string | null {
  const finishReason = (chunk as any)?.choices?.[0]?.finish_reason;
  return typeof finishReason === 'string' && finishReason ? finishReason : null;
}

export function assertProviderFinishReason(finishReason: string | null): void {
  if (finishReason && TRUNCATED_FINISH_REASONS.has(finishReason)) {
    throw new AiProviderStreamError(
      'ai_provider_output_truncated',
      `AI provider stopped with finish_reason=${finishReason}`
    );
  }
}

export function assertProviderStreamComplete(params: {
  doneReceived: boolean;
  finishReason: string | null;
}): void {
  assertProviderFinishReason(params.finishReason);
  if (
    params.doneReceived ||
    (params.finishReason && VALID_FINISH_REASONS.has(params.finishReason))
  ) {
    return;
  }
  throw new AiProviderStreamError(
    'ai_provider_stream_incomplete',
    'AI provider stream ended without a terminal marker'
  );
}
