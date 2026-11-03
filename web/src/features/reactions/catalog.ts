export const commonReactions = [
  '❤️',
  '👍🏿',
  '😂',
  '🥳',
  '🎉',
  '🔥',
  '🤩',
  '😎',
  '🤤',
  '🥹',
  '😮',
  '🤯',
  '🤔',
  '☹️',
  '😢',
  '😭',
  '😡',
  '🥵',
  '👎',
  '🙏',
  '💪',
  '👀',
  '💯',
  '🌟',
  '🐶',
  '😺',
  '😈',
  '🤡',
  '🤖',
  '🧌',
  '🌚',
  '💩',
  '🐛',
  '☕',
  '💡',
  '🚀',
] as const;

// Retired picker entries remain presets for existing and anonymous reactions.
const presetReactions = [...commonReactions, '👍', '⭐', '🎯', '✨', '👏', '🤝', '⚡', '🌝'];
const presetReactionOrder = new Map(presetReactions.map((type, index) => [type, index]));

export function isPresetReaction(type: string): boolean {
  return presetReactionOrder.has(type);
}

export function compareReactionTypes(a: string, b: string): number {
  return (
    (presetReactionOrder.get(a) ?? presetReactions.length) -
    (presetReactionOrder.get(b) ?? presetReactions.length)
  );
}
