const NOTE_PREVIEW_LENGTH = 36;
const ACTOR_PREVIEW_LENGTH = 32;
const REACTION_PREVIEW_LENGTH = 12;
const MAX_VISIBLE_REACTION_TYPES = 3;

type GraphemeSegmenter = {
  segment(value: string): Iterable<{ segment: string }>;
};

type GraphemeSegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' }
) => GraphemeSegmenter;

const GraphemeSegmenter = (Intl as unknown as { Segmenter: GraphemeSegmenterConstructor })
  .Segmenter;
const graphemeSegmenter = new GraphemeSegmenter(undefined, { granularity: 'grapheme' });

export type ReactionNotificationState = {
  actorKeys: string[];
  firstKnownActorName?: string;
  reactionTypes: Array<{
    identity: string;
    label: string;
  }>;
  noteLabel?: string;
};

export type ReactionNotificationInput = {
  actorKey: string;
  actorName?: string;
  reactionType: string;
  noteLabel?: string;
};

export type ReactionNotificationPresentation = {
  titleLocKey: string;
  bodyLocKey: string;
  titleLocArgs: string[];
  bodyLocArgs: string[];
};

function normalizedText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncated(value: string, maximumLength: number): string {
  const characters = Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment);
  if (characters.length <= maximumLength) return value;
  return `${characters.slice(0, maximumLength).join('')}…`;
}

export function reactionNoteLabel(
  title: string | null | undefined,
  content: string
): string | undefined {
  const titleText = normalizedText(title);
  const source = titleText || normalizedText(content);
  return source ? truncated(source, NOTE_PREVIEW_LENGTH) : undefined;
}

export function reactionActorName(nickname: string | null | undefined, username: string): string {
  return truncated(normalizedText(nickname) || normalizedText(username), ACTOR_PREVIEW_LENGTH);
}

export function canPresentDetailedReactionType(reactionType: string): boolean {
  return normalizedText(reactionType).length > 0;
}

export function mergeReactionNotificationState(
  current: ReactionNotificationState | null,
  input: ReactionNotificationInput
): ReactionNotificationState {
  const actorKeys = current?.actorKeys.includes(input.actorKey)
    ? current.actorKeys
    : [...(current?.actorKeys ?? []), input.actorKey];
  const reactionIdentity = normalizedText(input.reactionType);
  const reactionTypes = current?.reactionTypes.some(
    (reactionType) => reactionType.identity === reactionIdentity
  )
    ? current.reactionTypes
    : [
        ...(current?.reactionTypes ?? []),
        {
          identity: reactionIdentity,
          label: truncated(reactionIdentity, REACTION_PREVIEW_LENGTH),
        },
      ];
  const nextNoteLabel = truncated(normalizedText(input.noteLabel), NOTE_PREVIEW_LENGTH);
  return {
    actorKeys,
    firstKnownActorName:
      current?.firstKnownActorName ||
      (input.actorName
        ? truncated(normalizedText(input.actorName), ACTOR_PREVIEW_LENGTH)
        : undefined),
    reactionTypes,
    noteLabel: current?.noteLabel || nextNoteLabel || undefined,
  };
}

export function parseReactionNotificationState(value: unknown): ReactionNotificationState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Partial<ReactionNotificationState>;
  if (
    !Array.isArray(state.actorKeys) ||
    state.actorKeys.some((item) => typeof item !== 'string') ||
    !Array.isArray(state.reactionTypes) ||
    state.reactionTypes.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        typeof item.identity !== 'string' ||
        typeof item.label !== 'string'
    ) ||
    (state.noteLabel !== undefined && typeof state.noteLabel !== 'string') ||
    (state.firstKnownActorName !== undefined && typeof state.firstKnownActorName !== 'string')
  ) {
    return null;
  }
  return state as ReactionNotificationState;
}

function reactionSummary(reactionTypes: ReactionNotificationState['reactionTypes']): string {
  const visible = reactionTypes.slice(0, MAX_VISIBLE_REACTION_TYPES);
  const hiddenCount = reactionTypes.length - visible.length;
  return `${visible.map((item) => item.label).join(' ')}${hiddenCount > 0 ? ` +${hiddenCount}` : ''}`;
}

export function reactionNotificationPresentation(
  state: ReactionNotificationState
): ReactionNotificationPresentation {
  const actorCount = state.actorKeys.length;
  let titleLocKey: string;
  let titleLocArgs: string[];
  if (state.firstKnownActorName) {
    if (actorCount > 1) {
      titleLocKey = 'push.reaction.detail.known_multiple.title';
      titleLocArgs = [state.firstKnownActorName, String(actorCount - 1)];
    } else {
      titleLocKey = 'push.reaction.detail.known.title';
      titleLocArgs = [state.firstKnownActorName];
    }
  } else if (actorCount > 1) {
    titleLocKey = 'push.reaction.detail.anonymous_multiple.title';
    titleLocArgs = [String(actorCount)];
  } else {
    titleLocKey = 'push.reaction.detail.anonymous.title';
    titleLocArgs = [];
  }
  return {
    titleLocKey,
    bodyLocKey: state.noteLabel
      ? 'push.reaction.detail.body'
      : 'push.reaction.detail.body.unlabeled',
    titleLocArgs,
    bodyLocArgs: state.noteLabel
      ? [reactionSummary(state.reactionTypes), state.noteLabel]
      : [reactionSummary(state.reactionTypes)],
  };
}
