import { describe, expect, it } from 'bun:test';
import { APNS_MAX_PAYLOAD_BYTES, serializeApnsPayload } from './apns';
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
    expect(reactionActorName(family.repeat(40), 'fallback')).toBe(`${family.repeat(6)}…`);
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

  it('strips unsafe format controls while preserving visible ZWJ emoji', () => {
    expect(canPresentDetailedReactionType('\u200B\u202E')).toBe(false);
    expect(canPresentDetailedReactionType('👩‍💻')).toBe(true);
  });

  it('normalizes an invisible nickname before falling back to the username', () => {
    expect(reactionActorName(' <b> </b>\u200B', 'Alice')).toBe('Alice');
  });

  it('uses localized overflow bodies with the hidden count as a separate argument', () => {
    let state = mergeReactionNotificationState(null, {
      actorKey: 'user:alice',
      reactionType: '❤️',
      noteLabel: 'Summer wind',
    });
    for (const reactionType of ['👍', '🎉', '👏']) {
      state = mergeReactionNotificationState(state, {
        actorKey: 'user:alice',
        reactionType,
        noteLabel: 'Summer wind',
      });
    }
    expect(reactionNotificationPresentation(state)).toEqual({
      titleLocKey: 'push.reaction.detail.anonymous.title',
      bodyLocKey: 'push.reaction.detail.body.overflow',
      titleLocArgs: [],
      bodyLocArgs: ['❤️ 👍 🎉', '1', 'Summer wind'],
    });
  });

  it('bounds retained aggregate identities while keeping aggregate counts', () => {
    let state: ReturnType<typeof mergeReactionNotificationState> | null = null;
    for (let index = 0; index < 100; index += 1) {
      state = mergeReactionNotificationState(state, {
        actorKey: `visitor:${index}`,
        reactionType: `custom-${index}`,
        noteLabel: 'Summer wind',
      });
    }
    expect(state.actorKeyHashes).toHaveLength(32);
    expect(state.actorCount).toBe(100);
    expect(state.reactionTypes).toHaveLength(8);
    expect(state.reactionTypeCount).toBe(100);
    expect(Buffer.byteLength(JSON.stringify(state), 'utf8')).toBeLessThan(5_000);
  });

  it('bounds pathological graphemes so the completed APNs payload remains below 4 KB', () => {
    const noteLabel = reactionNoteLabel('', `a${'\u0301'.repeat(5_000)}`);
    const state = mergeReactionNotificationState(null, {
      actorKey: 'visitor:alpha',
      reactionType: '❤️',
      noteLabel,
    });
    const presentation = reactionNotificationPresentation(state);
    const payload = serializeApnsPayload({
      titleLocKey: presentation.titleLocKey,
      bodyLocKey: presentation.bodyLocKey,
      titleLocArgs: presentation.titleLocArgs,
      bodyLocArgs: presentation.bodyLocArgs,
      route: 'rote://detail?id=00000000-0000-0000-0000-000000000000',
      payload: { roteId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(noteLabel).toBeUndefined();
    expect(Buffer.byteLength(payload, 'utf8')).toBeLessThanOrEqual(APNS_MAX_PAYLOAD_BYTES);
  });

  it('truncates a maximal plain-text note without changing its bounded preview', () => {
    expect(reactionNoteLabel('', 'x'.repeat(1_000_000))).toBe(`${'x'.repeat(36)}…`);
  });
});
