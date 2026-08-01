import { describe, expect, it } from 'vitest';
import {
  availablePreReactions,
  defaultAnonymousPreReactions,
  mayCreateCustomReaction,
  mayToggleReaction,
} from './policy';

describe('reaction access policy', () => {
  it('uses the complete preset list for authenticated users', () => {
    expect(availablePreReactions(true, ['❤️', '👎'], [])).toEqual(['❤️', '👎']);
  });

  it('uses server anonymous presets and preserves an explicit empty list', () => {
    expect(availablePreReactions(false, ['👎'], ['❤️'])).toEqual(['❤️']);
    expect(availablePreReactions(false, ['👎'], [])).toEqual([]);
  });

  it('falls back to twelve anonymous presets for an older server', () => {
    expect(availablePreReactions(false, [], undefined)).toEqual([
      '❤️',
      '👍',
      '🎉',
      '👏',
      '✨',
      '💡',
      '🚀',
      '🙏',
      '💪',
      '🤝',
      '🔥',
      '🌟',
    ]);
    expect(defaultAnonymousPreReactions).toHaveLength(12);
  });

  it('lets anonymous visitors add allowed reactions or remove their own legacy reaction', () => {
    expect(
      mayToggleReaction({
        isAuthenticated: false,
        isAllowedAnonymousType: true,
        hasOwnReaction: false,
      })
    ).toBe(true);
    expect(
      mayToggleReaction({
        isAuthenticated: false,
        isAllowedAnonymousType: false,
        hasOwnReaction: true,
      })
    ).toBe(true);
    expect(
      mayToggleReaction({
        isAuthenticated: false,
        isAllowedAnonymousType: false,
        hasOwnReaction: false,
      })
    ).toBe(false);
  });

  it('reserves custom reaction creation for authenticated users', () => {
    expect(mayCreateCustomReaction(false)).toBe(false);
    expect(mayCreateCustomReaction(true)).toBe(true);
  });
});
