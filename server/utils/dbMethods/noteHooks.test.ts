import { describe, expect, test } from 'bun:test';
import { becamePublic } from './noteHooks';

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
});
