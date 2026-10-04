import { describe, expect, it } from 'vitest';
import { createAiRunHandlers, type AiRunLabels } from '@/state/aiRunHandlers';
import { getAiRunFailureMessage } from '@/state/aiRunManager';
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
