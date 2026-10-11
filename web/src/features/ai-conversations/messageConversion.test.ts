import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserializeMessages, serializeMessages } from './messageConversion';
import { sameSnapshot } from './reconciliation';
import { conversationErrorTranslation } from './errorPresentation';
import type { Conversation } from './types';

const fixture = JSON.parse(
  readFileSync('../server/aiConversations/fixtures/rich-history.json', 'utf8')
) as Conversation;

describe('canonical conversation conversion', () => {
  it('roundtrips the shared iOS/server fixture without losing rich output or null plans', () => {
    const local = deserializeMessages(fixture.messages);
    expect(local[1].outputs?.[0].status).toEqual({ type: 'sources', count: 1, added: 1 });
    expect(local[1].outputs?.[1].status).toEqual({ type: 'evidence_limit' });
    const wire = serializeMessages(local, fixture.createdAt, 'interrupted');
    expect(JSON.parse(JSON.stringify(wire))).toEqual(fixture.messages);
  });

  it('serializes a pending assistant as interrupted while preserving partial outputs and question dates', () => {
    const wire = serializeMessages(
      [
        { id: '1791691200000-question', role: 'user', content: 'question' },
        {
          id: 'legacy-answer',
          role: 'assistant',
          content: 'partial',
          isStreaming: true,
          outputs: [{ outputId: 'round', phase: 'answering', thinking: 'reasoning' }],
          timeline: [
            {
              id: 'phase',
              type: 'progress',
              phase: 'answering',
              status: 'running',
              updatedAt: 1791691201000,
            },
          ],
        },
      ],
      fixture.createdAt,
      'interrupted'
    );
    expect(wire[0].createdAt).toBe(fixture.createdAt);
    expect(wire[1]).toMatchObject({ content: 'partial', error: true, errorDetail: 'interrupted' });
    expect(wire[1]).not.toHaveProperty('isStreaming');
    expect(wire[1].timeline?.[0]).toMatchObject({
      status: 'error',
      updatedAt: '2026-10-11T04:00:01.000Z',
    });
    expect(wire[1].outputs?.[0]).toMatchObject({ id: 'round', thinking: 'reasoning' });
  });

  it('compares snapshots after JSONB has reordered nested metadata properties', () => {
    const original = { createdAt: fixture.createdAt, messages: fixture.messages };
    const reverse = (value: any): any =>
      Array.isArray(value)
        ? value.map(reverse)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, child]) => [key, reverse(child)])
            )
          : value;
    expect(sameSnapshot(original, reverse(original))).toBe(true);
  });

  it.each(['response_interrupted', 'ai_memory.error.interrupted', 'ai_memory.messages.stopped'])(
    'maps %s without rewriting stored error details',
    (detail) => {
      expect(conversationErrorTranslation(detail)).toBe('messages.interrupted');
    }
  );
});
