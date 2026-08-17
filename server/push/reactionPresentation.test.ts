import { describe, expect, it } from 'bun:test';
import {
  canPresentDetailedReactionType,
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

  it('uses a localized unlabeled-note body when title and content are empty', () => {
    const state = mergeReactionNotificationState(null, {
      actorKey: 'visitor:alpha',
      reactionType: '❤️',
      noteLabel: reactionNoteLabel(' ', '<p> </p>') ?? '',
    });
    expect(reactionNotificationPresentation(state)).toEqual({
      titleLocKey: 'push.reaction.detail.anonymous.title',
      bodyLocKey: 'push.reaction.detail.body.unlabeled',
      titleLocArgs: [],
      bodyLocArgs: ['❤️'],
    });
  });

  it('truncates text on grapheme boundaries', () => {
    const family = '👨‍👩‍👧‍👦';
    expect(reactionActorName(family.repeat(40), 'fallback')).toBe(`${family.repeat(32)}…`);
  });

  it('deduplicates custom reactions by their full normalized identity', () => {
    let state = mergeReactionNotificationState(null, {
      actorKey: 'user:alice',
      reactionType: 'abcdefghijkl-first',
      noteLabel: 'Summer wind',
    });
    state = mergeReactionNotificationState(state, {
      actorKey: 'user:bob',
      reactionType: 'abcdefghijkl-second',
      noteLabel: 'Summer wind',
    });
    expect(state.reactionTypes).toHaveLength(2);
  });

  it('rejects reaction details that normalize to empty', () => {
    expect(canPresentDetailedReactionType(' \n\u0000<p></p> ')).toBe(false);
  });
});
