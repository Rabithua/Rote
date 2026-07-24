import { describe, expect, test } from 'bun:test';
import { becamePublic, editRoteWithPublicTransition } from './noteHooks';

describe('public note notification transitions', () => {
  test('triggers when a private note becomes public', () => {
    expect(becamePublic('private', 'public')).toBe(true);
  });

  test('triggers when a new note is created as public', () => {
    expect(becamePublic(undefined, 'public')).toBe(true);
  });

  test('does not trigger when a public note stays public', () => {
    expect(becamePublic('public', 'public')).toBe(false);
  });

  test('does not trigger for transitions that end as non-public', () => {
    expect(becamePublic('public', 'private')).toBe(false);
    expect(becamePublic('private', 'private')).toBe(false);
  });

  test('allows only one concurrent edit to claim the public transition', async () => {
    let currentState = 'private';
    let previousEdit = Promise.resolve();
    const edit = async (data: { id: string; state: string }) => {
      const waitForPreviousEdit = previousEdit;
      let finishEdit: () => void = () => {};
      previousEdit = new Promise<void>((resolve) => {
        finishEdit = resolve;
      });

      await waitForPreviousEdit;
      const previousState = currentState;
      currentState = data.state;
      finishEdit();
      return {
        nextState: currentState,
        note: { ...data, state: currentState },
        previousState,
      };
    };

    const results = await Promise.all([
      editRoteWithPublicTransition({ id: 'note-1', state: 'public' }, edit),
      editRoteWithPublicTransition({ id: 'note-1', state: 'public' }, edit),
    ]);

    expect(results.filter((result) => result.becamePublic)).toHaveLength(1);
    expect(results.every((result) => result.note.state === 'public')).toBe(true);
  });
});
