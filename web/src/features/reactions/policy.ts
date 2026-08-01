export const defaultAnonymousPreReactions = [
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
] as const;

interface ReactionAccessInput {
  isAuthenticated: boolean;
  isAllowedAnonymousType: boolean;
  hasOwnReaction: boolean;
}

export function availablePreReactions(
  isAuthenticated: boolean,
  preReactions: readonly string[],
  anonymousPreReactions?: readonly string[]
): readonly string[] {
  if (isAuthenticated) return preReactions;
  return anonymousPreReactions ?? defaultAnonymousPreReactions;
}

export function mayToggleReaction({
  isAuthenticated,
  isAllowedAnonymousType,
  hasOwnReaction,
}: ReactionAccessInput): boolean {
  return isAuthenticated || isAllowedAnonymousType || hasOwnReaction;
}

export function mayCreateCustomReaction(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}
