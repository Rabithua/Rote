import { describe, expect, it } from 'vitest';
import type { AiRunLabels } from '@/state/aiRunHandlers';
import { getAiRunFailureMessage } from '@/state/aiRunManager';
import { AiStreamError } from '@/utils/aiStream';

const labels: AiRunLabels = {
  phase: (phase) => phase,
  toolStarted: (toolName) => toolName,
  toolStatus: (status) => status,
  toolFinished: (toolName) => toolName,
  sourcesFound: (count) => String(count),
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
