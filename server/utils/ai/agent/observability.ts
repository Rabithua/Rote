import { isAiProviderStreamError } from '../client';

export type AiStreamFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export function createAiRunId(prefix: 'agent' | 'chat' = 'agent'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function classifyAiStreamError(error: unknown): AiStreamFailure {
  if (isAiProviderStreamError(error)) {
    return {
      code: error.code,
      message: error.code,
      retryable: error.retryable,
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    const code = 'ai_client_disconnected';
    return {
      code,
      message: code,
      retryable: true,
    };
  }

  const code = 'ai_agent_failed';
  return {
    code,
    message: code,
    retryable: true,
  };
}

export function logAiStreamLifecycle(
  level: 'info' | 'error',
  event: 'started' | 'completed' | 'failed',
  fields: Record<string, unknown>
): void {
  const payload = JSON.stringify({
    scope: 'ai_stream',
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') console.error(payload);
  else console.info(payload);
}
