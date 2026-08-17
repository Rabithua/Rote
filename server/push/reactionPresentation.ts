import { createHash } from 'node:crypto';

const NOTE_PREVIEW_LENGTH = 36;
const NOTE_PREVIEW_BYTES = 256;
const ACTOR_PREVIEW_LENGTH = 32;
const ACTOR_PREVIEW_BYTES = 160;
const REACTION_PREVIEW_LENGTH = 12;
const REACTION_PREVIEW_BYTES = 64;
const MAX_VISIBLE_REACTION_TYPES = 3;
const MAX_TRACKED_ACTORS = 32;
const MAX_TRACKED_REACTION_TYPES = 8;

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
const visibleReactionCharacter = /[\p{L}\p{N}\p{P}\p{S}]/u;

export type ReactionNotificationState = {
  actorKeyHashes: string[];
  actorsOverflowed: boolean;
  firstKnownActorName?: string;
  reactionTypes: Array<{
    identityHash: string;
    label: string;
  }>;
  reactionTypesOverflowed: boolean;
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
    .replace(/\p{Cf}/gu, (character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      const isEmojiTag = codePoint >= 0xe0020 && codePoint <= 0xe007f;
      return character === '\u200D' || isEmojiTag ? character : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function identityHash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function truncated(
  value: string,
  maximumLength: number,
  maximumUtf8Bytes: number
): string | undefined {
  if (!value) return undefined;
  const segments: string[] = [];
  let byteLength = 0;
  let wasTruncated = false;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentBytes = Buffer.byteLength(segment, 'utf8');
    if (segments.length >= maximumLength || byteLength + segmentBytes > maximumUtf8Bytes) {
      wasTruncated = true;
      break;
    }
    segments.push(segment);
    byteLength += segmentBytes;
  }
  if (!segments.length) return undefined;
  if (!wasTruncated) return segments.join('');

  const suffix = '…';
  const suffixBytes = Buffer.byteLength(suffix, 'utf8');
  while (segments.length && byteLength + suffixBytes > maximumUtf8Bytes) {
    byteLength -= Buffer.byteLength(segments.pop()!, 'utf8');
  }
  return segments.length ? `${segments.join('')}${suffix}` : undefined;
}

export function reactionNoteLabel(
  title: string | null | undefined,
  content: string
): string | undefined {
  const titleText = normalizedText(title);
  const source = titleText || normalizedText(content);
  return source ? truncated(source, NOTE_PREVIEW_LENGTH, NOTE_PREVIEW_BYTES) : undefined;
}

export function reactionActorName(
  nickname: string | null | undefined,
  username: string
): string | undefined {
  return truncated(
    normalizedText(nickname) || normalizedText(username),
    ACTOR_PREVIEW_LENGTH,
    ACTOR_PREVIEW_BYTES
  );
}

export function canPresentDetailedReactionType(reactionType: string): boolean {
  const normalized = normalizedText(reactionType);
  return (
    visibleReactionCharacter.test(normalized) &&
    truncated(normalized, REACTION_PREVIEW_LENGTH, REACTION_PREVIEW_BYTES) !== undefined
  );
}

export function mergeReactionNotificationState(
  current: ReactionNotificationState | null,
  input: ReactionNotificationInput
): ReactionNotificationState {
  const actorKeyHash = identityHash(input.actorKey);
  const actorAlreadyTracked = current?.actorKeyHashes.includes(actorKeyHash) ?? false;
  const canTrackActor = (current?.actorKeyHashes.length ?? 0) < MAX_TRACKED_ACTORS;
  const actorKeyHashes =
    actorAlreadyTracked || !canTrackActor
      ? (current?.actorKeyHashes ?? [])
      : [...(current?.actorKeyHashes ?? []), actorKeyHash];
  const actorsOverflowed =
    current?.actorsOverflowed === true || (!actorAlreadyTracked && !canTrackActor);

  const reactionIdentity = normalizedText(input.reactionType);
  const reactionIdentityHash = identityHash(reactionIdentity);
  const reactionAlreadyTracked =
    current?.reactionTypes.some(
      (reactionType) => reactionType.identityHash === reactionIdentityHash
    ) ?? false;
  const reactionLabel = truncated(
    reactionIdentity,
    REACTION_PREVIEW_LENGTH,
    REACTION_PREVIEW_BYTES
  );
  const canTrackReactionType = (current?.reactionTypes.length ?? 0) < MAX_TRACKED_REACTION_TYPES;
  const reactionTypes =
    reactionAlreadyTracked || !reactionLabel || !canTrackReactionType
      ? (current?.reactionTypes ?? [])
      : [
          ...(current?.reactionTypes ?? []),
          {
            identityHash: reactionIdentityHash,
            label: reactionLabel,
          },
        ];
  const reactionTypesOverflowed =
    current?.reactionTypesOverflowed === true ||
    (!reactionAlreadyTracked && Boolean(reactionLabel) && !canTrackReactionType);
  const nextActorName = truncated(
    normalizedText(input.actorName),
    ACTOR_PREVIEW_LENGTH,
    ACTOR_PREVIEW_BYTES
  );
  const nextNoteLabel = truncated(
    normalizedText(input.noteLabel),
    NOTE_PREVIEW_LENGTH,
    NOTE_PREVIEW_BYTES
  );
  return {
    actorKeyHashes,
    actorsOverflowed,
    firstKnownActorName: current?.firstKnownActorName || nextActorName,
    reactionTypes,
    reactionTypesOverflowed,
    noteLabel: current?.noteLabel || nextNoteLabel,
  };
}

export function parseReactionNotificationState(value: unknown): ReactionNotificationState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Partial<ReactionNotificationState>;
  if (
    !Array.isArray(state.actorKeyHashes) ||
    state.actorKeyHashes.length > MAX_TRACKED_ACTORS ||
    state.actorKeyHashes.some((item) => typeof item !== 'string') ||
    typeof state.actorsOverflowed !== 'boolean' ||
    (state.actorsOverflowed && state.actorKeyHashes.length !== MAX_TRACKED_ACTORS) ||
    !Array.isArray(state.reactionTypes) ||
    state.reactionTypes.length > MAX_TRACKED_REACTION_TYPES ||
    state.reactionTypes.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        typeof item.identityHash !== 'string' ||
        typeof item.label !== 'string'
    ) ||
    typeof state.reactionTypesOverflowed !== 'boolean' ||
    (state.reactionTypesOverflowed && state.reactionTypes.length !== MAX_TRACKED_REACTION_TYPES) ||
    (state.noteLabel !== undefined && typeof state.noteLabel !== 'string') ||
    (state.firstKnownActorName !== undefined && typeof state.firstKnownActorName !== 'string')
  ) {
    return null;
  }
  return state as ReactionNotificationState;
}

function visibleReactionSummary(state: ReactionNotificationState): string {
  return state.reactionTypes
    .slice(0, MAX_VISIBLE_REACTION_TYPES)
    .map((item) => item.label)
    .join(' ');
}

export function reactionNotificationPresentation(
  state: ReactionNotificationState
): ReactionNotificationPresentation {
  const actorCount = state.actorKeyHashes.length;
  let titleLocKey: string;
  let titleLocArgs: string[];
  if (state.firstKnownActorName) {
    if (state.actorsOverflowed) {
      titleLocKey = 'push.reaction.detail.known_many.title';
      titleLocArgs = [state.firstKnownActorName];
    } else if (actorCount > 1) {
      titleLocKey = 'push.reaction.detail.known_multiple.title';
      titleLocArgs = [state.firstKnownActorName, String(actorCount - 1)];
    } else {
      titleLocKey = 'push.reaction.detail.known.title';
      titleLocArgs = [state.firstKnownActorName];
    }
  } else if (state.actorsOverflowed) {
    titleLocKey = 'push.reaction.detail.anonymous_many.title';
    titleLocArgs = [];
  } else if (actorCount > 1) {
    titleLocKey = 'push.reaction.detail.anonymous_multiple.title';
    titleLocArgs = [String(actorCount)];
  } else {
    titleLocKey = 'push.reaction.detail.anonymous.title';
    titleLocArgs = [];
  }

  const summary = visibleReactionSummary(state);
  if (state.reactionTypesOverflowed) {
    return {
      titleLocKey,
      bodyLocKey: state.noteLabel
        ? 'push.reaction.detail.body.many'
        : 'push.reaction.detail.body.unlabeled.many',
      titleLocArgs,
      bodyLocArgs: state.noteLabel ? [summary, state.noteLabel] : [summary],
    };
  }
  const hiddenReactionCount = Math.max(0, state.reactionTypes.length - MAX_VISIBLE_REACTION_TYPES);
  if (hiddenReactionCount > 0) {
    return {
      titleLocKey,
      bodyLocKey: state.noteLabel
        ? 'push.reaction.detail.body.overflow'
        : 'push.reaction.detail.body.unlabeled.overflow',
      titleLocArgs,
      bodyLocArgs: state.noteLabel
        ? [summary, String(hiddenReactionCount), state.noteLabel]
        : [summary, String(hiddenReactionCount)],
    };
  }
  return {
    titleLocKey,
    bodyLocKey: state.noteLabel
      ? 'push.reaction.detail.body'
      : 'push.reaction.detail.body.unlabeled',
    titleLocArgs,
    bodyLocArgs: state.noteLabel ? [summary, state.noteLabel] : [summary],
  };
}
