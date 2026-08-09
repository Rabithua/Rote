import mainJson from '../json/main.json';

export const anonymousPreReactions = mainJson.anonymousPreReactions;

const anonymousReactionSet = new Set<string>(anonymousPreReactions);

export function isAnonymousReactionAllowed(type: string): boolean {
  return anonymousReactionSet.has(type);
}

export function mayAddReaction(isAuthenticated: boolean, type: string): boolean {
  return isAuthenticated || isAnonymousReactionAllowed(type);
}
