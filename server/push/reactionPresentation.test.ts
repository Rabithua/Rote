import { describe, expect, it } from 'bun:test';
import {
  mergeReactionNotificationState,
  reactionActorName,
  reactionNoteLabel,
  reactionNotificationPresentation,
} from './reactionPresentation';

describe('reaction notification presentation', () => {
  it('uses the known actor, reaction, and note label for a single response', () => {
    const state = mergeReactionNotificationState(null, {
      actorKey: 'user:alice',
      actorName: 'Alice',
      reactionType: '❤️',
      noteLabel: 'Summer wind',
    });
    expect(reactionNotificationPresentation(state)).toEqual({
      titleLocKey: 'push.reaction.detail.known.title',
      bodyLocKey: 'push.reaction.detail.body',
      titleLocArgs: ['Alice'],
      bodyLocArgs: ['❤️', 'Summer wind'],
    });
  });

  it('aggregates unique actors and response types while preserving the first actor', () => {
    const first = mergeReactionNotificationState(null, {
      actorKey: 'user:alice',
      actorName: 'Alice',
      reactionType: '❤️',
      noteLabel: 'Summer wind',
    });
    const repeatedActor = mergeReactionNotificationState(first, {
      actorKey: 'user:alice',
      actorName: 'Alice',
      reactionType: '👍',
      noteLabel: 'Summer wind',
    });
    const anotherActor = mergeReactionNotificationState(repeatedActor, {
      actorKey: 'visitor:beta',
      reactionType: '🎉',
      noteLabel: 'Summer wind',
    });
    expect(reactionNotificationPresentation(anotherActor)).toEqual({
      titleLocKey: 'push.reaction.detail.known_multiple.title',
      bodyLocKey: 'push.reaction.detail.body',
      titleLocArgs: ['Alice', '1'],
      bodyLocArgs: ['❤️ 👍 🎉', 'Summer wind'],
    });
  });

  it('uses localized anonymous titles without embedding a server-language label', () => {
    const state = mergeReactionNotificationState(null, {
      actorKey: 'visitor:alpha',
      reactionType: '👏',
      noteLabel: 'Summer wind',
    });
    expect(reactionNotificationPresentation(state)).toEqual({
      titleLocKey: 'push.reaction.detail.anonymous.title',
      bodyLocKey: 'push.reaction.detail.body',
      titleLocArgs: [],
      bodyLocArgs: ['👏', 'Summer wind'],
    });
  });

  it('falls back to a bounded content excerpt when a note has no title', () => {
    expect(reactionNoteLabel('  ', `  ${'记'.repeat(50)}\nnext line  `)).toBe(
      `${'记'.repeat(36)}…`
    );
    expect(reactionActorName('  Alice\nSmith  ', 'fallback')).toBe('Alice Smith');
  });
});
