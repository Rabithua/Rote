import { describe, expect, it } from 'bun:test';
import { createAiSseAbortControl, type AiSseStream } from '../route/v2/aiAgentSse';
import { addAiChatStreamUsage, createAiChatStreamMetrics } from '../route/v2/aiStreamMetrics';

function abortableStream() {
  let listener: (() => void | Promise<void>) | undefined;
  const stream = {
    onAbort(next: () => void | Promise<void>) {
      listener = next;
    },
  } as unknown as AiSseStream;

  return {
    stream,
    abort: async () => listener?.(),
  };
}

describe('AI SSE abort control', () => {
  it('cancels provider work when the response stream is aborted', async () => {
    const response = abortableStream();
    const request = new AbortController();
    const control = createAiSseAbortControl(response.stream, request.signal);

    await response.abort();

    expect(control.signal.aborted).toBe(true);
    expect(control.signal.reason).toMatchObject({ name: 'AbortError' });
    control.cleanup();
  });

  it('also propagates request-side cancellation', () => {
    const response = abortableStream();
    const request = new AbortController();
    const control = createAiSseAbortControl(response.stream, request.signal);
    const reason = new DOMException('', 'AbortError');

    request.abort(reason);

    expect(control.signal.aborted).toBe(true);
    expect(control.signal.reason).toBe(reason);
    control.cleanup();
  });
});

describe('AI chat lifecycle metrics', () => {
  it('aggregates planner and answer token usage', () => {
    const metrics = createAiChatStreamMetrics();
    addAiChatStreamUsage(metrics, {
      prompt_tokens: 10,
      completion_tokens: 2,
      total_tokens: 12,
    });
    addAiChatStreamUsage(metrics, {
      prompt_tokens: 20,
      completion_tokens: 5,
      total_tokens: 25,
    });

    expect(metrics).toMatchObject({
      promptTokens: 30,
      completionTokens: 7,
      totalTokens: 37,
    });
  });
});
