import { describe, expect, it, vi } from 'vitest';
import { sanitizeAiChatMessages, sanitizeAiSourceKeys, type AiMemoryMessage } from '@/state/aiChat';
import { readAiStreamResponse } from '@/utils/aiStream';

function streamResponse(blocks: string[], options: { close?: boolean } = {}) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        blocks.forEach((block) => controller.enqueue(encoder.encode(`${block}\n\n`)));
        if (options.close !== false) controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

describe('AI server stream reader', () => {
  it('finishes exactly once after an explicit done event', async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();

    await readAiStreamResponse(
      streamResponse([
        'event: delta\ndata: {"text":"answer"}',
        'event: done\ndata: {}',
        'event: done\ndata: {}',
      ]),
      { onDelta, onDone }
    );

    expect(onDelta).toHaveBeenCalledWith('answer');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('throws structured server errors without reporting done', async () => {
    const onError = vi.fn();
    const onDone = vi.fn();
    const request = readAiStreamResponse(
      streamResponse([
        'event: delta\ndata: {"text":"partial"}',
        'event: error\ndata: {"code":"ai_provider_stream_incomplete","message":"failed","runId":"agent_1","retryable":true}',
      ]),
      { onError, onDone }
    );

    await expect(request).rejects.toMatchObject({
      code: 'ai_provider_stream_incomplete',
      runId: 'agent_1',
      retryable: true,
    });
    expect(onError).toHaveBeenCalledWith({
      code: 'ai_provider_stream_incomplete',
      message: 'failed',
      runId: 'agent_1',
      retryable: true,
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('rejects EOF when the server omits done', async () => {
    const onDelta = vi.fn();

    await expect(
      readAiStreamResponse(streamResponse(['event: delta\ndata: {"text":"partial"}']), {
        onDelta,
      })
    ).rejects.toMatchObject({ code: 'ai_stream_incomplete' });
    expect(onDelta).toHaveBeenCalledWith('partial');
  });

  it('rejects a server stream that stays idle', async () => {
    await expect(
      readAiStreamResponse(streamResponse([], { close: false }), {}, { idleTimeoutMs: 5 })
    ).rejects.toMatchObject({ code: 'ai_stream_timeout' });
  });
});

describe('interrupted AI message state', () => {
  it('preserves partial content and marks it as an error', () => {
    const messages: AiMemoryMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'partial answer',
        isStreaming: true,
        timeline: [
          {
            id: 'progress-answering',
            type: 'progress',
            phase: 'answering',
            message: 'answering',
            status: 'running',
            updatedAt: 1,
          },
        ],
      },
    ];

    const [message] = sanitizeAiChatMessages(messages, 'response interrupted');

    expect(message).toMatchObject({
      content: 'partial answer',
      error: true,
      errorDetail: 'response interrupted',
    });
    expect(message.isStreaming).toBeUndefined();
    expect(message.timeline?.[0].status).toBe('error');
  });

  it('drops malformed and duplicate source keys before the next request', () => {
    const valid = 'rote:00000000-0000-4000-8000-000000000001';
    expect(sanitizeAiSourceKeys([valid, valid, 'rote:not-a-uuid', 'unknown:value'])).toEqual([
      valid,
    ]);
  });
});
