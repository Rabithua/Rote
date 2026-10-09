import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultStore } from 'jotai';
import { aiChatMessagesAtom } from '@/state/aiChat';
import { createAiRunHandlers, type AiRunLabels } from '@/state/aiRunHandlers';
import { clearAiRun, getAiRunFailureMessage, startAiRun } from '@/state/aiRunManager';
import { AiStreamError } from '@/utils/aiStream';

const labels: AiRunLabels = {
  phase: (phase) => phase,
  toolStarted: (toolName) => toolName,
  toolStatus: (status) => status,
  toolFinished: (toolName) => toolName,
  sourcesFound: (count) => String(count),
  sourcesAdded: (added, total) => `${added}/${total}`,
  evidenceLimit: 'reading limit',
  askFailed: 'failed',
  streamInterrupted: 'interrupted',
  streamTimeout: 'timeout',
  streamTruncated: 'truncated',
  fallbackNoAnswerWithSources: 'no-answer-with-sources',
  fallbackNoAnswerNoSources: 'no-answer-no-sources',
};

afterEach(() => {
  clearAiRun();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([false, true])(
  'keeps identified output after run cleanup (interrupted: %s)',
  async (interrupted) => {
    clearAiRun();
    const blocks = [
      'event: output_started\ndata: {"outputId":"step-0","phase":"planning"}',
      'event: thinking\ndata: {"outputId":"step-0","phase":"route_decision","text":"First reasoning"}',
      'event: delta\ndata: {"outputId":"step-0","phase":"planning","text":"I will search."}',
      'event: output_finished\ndata: {"outputId":"step-0","phase":"planning","kind":"process"}',
      'event: output_started\ndata: {"outputId":"step-1","phase":"tool_calling"}',
      'event: thinking\ndata: {"outputId":"step-1","phase":"evidence_decision","text":"Second reasoning"}',
      'event: delta\ndata: {"outputId":"step-1","phase":"tool_calling","text":"The answer"}',
      ...(interrupted
        ? []
        : [
            'event: output_finished\ndata: {"outputId":"step-1","phase":"tool_calling","kind":"answer"}',
            'event: done\ndata: {}',
          ]),
    ];
    const request = vi.fn(async () => new Response(blocks.join('\n\n') + '\n\n'));
    vi.stubGlobal('fetch', request);
    await startAiRun({
      question: 'Review notes',
      messages: [],
      pendingPlan: null,
      unavailable: false,
      mode: 'site',
      toolsAvailable: true,
      labels,
    });
    const answer = getDefaultStore().get(aiChatMessagesAtom).at(-1)!;
    expect(answer.content).toBe(interrupted ? '' : 'The answer');
    expect(answer.outputs?.[0]).toMatchObject({ text: 'I will search.', kind: 'process' });
    expect(answer.isStreaming).toBe(false);
    expect(answer.error).toBe(interrupted ? true : undefined);
    if (interrupted) expect(answer.errorDetail).toBe('interrupted');
    expect(answer.outputs?.[0].thinking).toBe('First reasoning');
    expect(answer.outputs?.[1].thinking).toBe('Second reasoning');
    expect(answer.outputs?.[1].text).toBe(interrupted ? 'The answer' : undefined);
    expect(answer.thinking).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  }
);

describe('AI run failure labels', () => {
  it.each([
    ['ai_stream_incomplete', 'interrupted'],
    ['ai_provider_stream_incomplete', 'interrupted'],
    ['ai_stream_timeout', 'timeout'],
    ['ai_provider_timeout', 'timeout'],
    ['ai_provider_output_truncated', 'truncated'],
    ['error_no_answer_with_sources', 'no-answer-with-sources'],
    ['error_no_answer_no_sources', 'no-answer-no-sources'],
    ['ai_agent_failed', 'failed'],
  ])('maps %s to a localized failure message', (code, expected) => {
    const error = new AiStreamError({ code, message: 'raw server message', retryable: true });
    expect(getAiRunFailureMessage(error, labels)).toBe(expected);
  });
});

it('keeps streamed process text out of the answer and does not replay final chunks', () => {
  let messages: import('@/state/aiChat').AiMemoryMessage[] = [
    { id: 'answer', role: 'assistant', content: '', isStreaming: true },
  ];
  let queuedChunks = 0;
  const handlers = createAiRunHandlers({
    assistantId: 'answer',
    labels,
    progress: { currentIsMore: false, receivedClarification: false },
    startedAt: performance.now(),
    seenSourceIds: new Set(),
    isActiveRun: () => true,
    setMessagesForActiveRun: (_id, updater) => {
      messages = updater(messages);
    },
    queueStreamDelta: () => {
      queuedChunks += 1;
    },
    mergeAgentState: () => {},
  });
  handlers.onOutputDelta?.({ outputId: 'step-0', phase: 'planning', text: 'I will search.' });
  handlers.flushOutputs();
  expect(messages[0].content).toBe('');
  expect(messages[0].outputs?.[0].text).toBe('I will search.');
  expect(messages[0].outputs?.[0].kind).toBeUndefined();
  handlers.onOutputFinished?.({ outputId: 'step-0', phase: 'planning', kind: 'process' });
  expect(messages[0].content).toBe('');
  expect(messages[0].outputs?.[0]).toMatchObject({ text: 'I will search.', kind: 'process' });
  handlers.onOutputDelta?.({ outputId: 'step-1', phase: 'tool_calling', text: 'The answer ' });
  handlers.flushOutputs();
  expect(messages[0].content).toBe('');
  expect(messages[0].outputs?.[1].text).toBe('The answer ');
  handlers.onOutputDelta?.({ outputId: 'step-1', phase: 'tool_calling', text: 'is here.' });
  handlers.onOutputFinished?.({ outputId: 'step-1', phase: 'tool_calling', kind: 'answer' });
  expect(messages[0].content).toBe('The answer is here.');
  expect(messages[0].outputs?.[1].text).toBeUndefined();
  handlers.onOutputFinished?.({ outputId: 'step-1', phase: 'tool_calling', kind: 'answer' });
  expect(messages[0].content).toBe('The answer is here.');
  expect(queuedChunks).toBe(0);
});

it('drops pending fragments and late events when the active run is cleared', () => {
  let active = true;
  const update = vi.fn();
  const handlers = createAiRunHandlers({
    assistantId: 'answer',
    labels,
    progress: { currentIsMore: false, receivedClarification: false },
    startedAt: performance.now(),
    seenSourceIds: new Set(),
    isActiveRun: () => active,
    setMessagesForActiveRun: update,
    queueStreamDelta: () => {},
    mergeAgentState: () => {},
  });
  handlers.onOutputDelta?.({ outputId: 'step-0', phase: 'planning', text: 'Partial' });
  handlers.cancelOutputs();
  active = false;
  handlers.flushOutputs();
  handlers.onOutputStarted?.({ outputId: 'step-1', phase: 'tool_calling' });
  handlers.onOutputFinished?.({ outputId: 'step-0', phase: 'planning', kind: 'answer' });
  expect(update).not.toHaveBeenCalled();
});

it('batches frequent text and thinking fragments into one storage update per frame', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  let messages: import('@/state/aiChat').AiMemoryMessage[] = [
    { id: 'answer', role: 'assistant', content: '' },
  ];
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const handlers = createAiRunHandlers({
    assistantId: 'answer',
    labels,
    progress: { currentIsMore: false, receivedClarification: false },
    startedAt: performance.now(),
    seenSourceIds: new Set(),
    isActiveRun: () => true,
    setMessagesForActiveRun: (_id, updater) => {
      messages = updater(messages);
      getDefaultStore().set(aiChatMessagesAtom, messages);
    },
    queueStreamDelta: () => {},
    mergeAgentState: () => {},
  });
  for (let index = 0; index < 100; index += 1) {
    handlers.onOutputDelta?.({ outputId: 'step-0', phase: 'planning', text: 'x' });
    handlers.onThinking?.('route_decision', 'y', 'step-0');
  }
  expect(frames).toHaveLength(1);
  expect(storage).not.toHaveBeenCalled();
  frames[0](performance.now());
  expect(storage).toHaveBeenCalledTimes(1);
  expect(messages[0].outputs?.[0]).toMatchObject({
    text: 'x'.repeat(100),
    thinking: 'y'.repeat(100),
  });
  expect(messages[0].content).toBe('');
  handlers.cancelOutputs();
  vi.restoreAllMocks();
});

it('uses cumulative references and localizes exhaustion', () => {
  let messages: import('@/state/aiChat').AiMemoryMessage[] = [
    { id: 'answer', role: 'assistant', content: '' },
  ];
  const handlers = createAiRunHandlers({
    assistantId: 'answer',
    labels,
    progress: { currentIsMore: false, receivedClarification: false },
    startedAt: 0,
    seenSourceIds: new Set(),
    isActiveRun: () => true,
    setMessagesForActiveRun: (_id, updater) => {
      messages = updater(messages);
    },
    queueStreamDelta: () => {},
    mergeAgentState: () => {},
  });
  const sources = Array.from({ length: 40 }, (_, i) => ({
    sourceType: 'rote' as const,
    sourceId: `note-${i + 1}`,
    similarity: 1,
    metadata: {},
  }));
  handlers.onSources?.(sources.slice(0, 20), {
    foundCount: 20,
    addedCount: 20,
    totalCount: 20,
    budgetExhausted: false,
  });
  handlers.onSources?.(sources, {
    foundCount: 20,
    addedCount: 20,
    totalCount: 40,
    budgetExhausted: false,
  });
  expect(messages[0].sources).toHaveLength(40);
  expect(messages[0].timeline?.at(-1)?.message).toBe('20/40');
  expect(messages[0].retrieval?.totalCount).toBe(40);
  handlers.onSources?.(sources, {
    foundCount: 0,
    addedCount: 0,
    totalCount: 40,
    budgetExhausted: true,
  });
  handlers.onProgress?.('answering');
  expect(messages[0].timeline?.at(-1)?.message).toBe('reading limit');
  handlers.onSources?.(sources);
  expect(messages[0].timeline?.find((item) => item.id === 'tool-rote_search_notes')?.message).toBe(
    '40'
  );
});
