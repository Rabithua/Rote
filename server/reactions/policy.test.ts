import { describe, expect, it } from 'bun:test';
import mainJson from '../json/main.json';
import { anonymousPreReactions, isAnonymousReactionAllowed, mayAddReaction } from './policy';

describe('anonymous reaction policy', () => {
  it('contains twelve unique positive presets in the configured order', () => {
    expect(anonymousPreReactions).toEqual([
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
    expect(new Set(anonymousPreReactions).size).toBe(12);
    expect(
      anonymousPreReactions.every((reaction) => mainJson.preReactions.includes(reaction))
    ).toBe(true);
  });

  it('allows only configured anonymous reaction types', () => {
    expect(isAnonymousReactionAllowed('❤️')).toBe(true);
    expect(isAnonymousReactionAllowed('👎')).toBe(false);
    expect(isAnonymousReactionAllowed('custom reaction')).toBe(false);
  });

  it('keeps custom reactions available to authenticated users', () => {
    expect(mayAddReaction(false, '❤️')).toBe(true);
    expect(mayAddReaction(false, 'custom reaction')).toBe(false);
    expect(mayAddReaction(true, 'custom reaction')).toBe(true);
  });
});
