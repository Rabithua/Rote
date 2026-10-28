import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { pushEvents } from '../drizzle/schema';
import { db } from '../utils/drizzle';
import { readPushPayloadMetadata, withPushPayloadMetadata } from './payload';
import {
  canPresentDetailedReactionType,
  mergeReactionNotificationState,
  parseReactionNotificationState,
  REACTION_RECEIVED_EVENT_TYPE,
  reactionNoteLabel,
  reactionNotificationPresentation,
} from './reactionPresentation';
import type { ReactionNotificationSender } from './reactionPresentation';

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function enqueueAggregatedReactionPushEventInTransaction(
  transaction: DatabaseTransaction,
  input: {
    userid: string;
    roteId: string;
    reactionType?: string;
    actorKey?: string;
    actorName?: string;
    sender?: ReactionNotificationSender;
    noteTitle?: string | null;
    noteContent?: string;
  }
): Promise<void> {
  const now = new Date();
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`push-reaction:${input.userid}:${input.roteId}`}))`
  );
  const [pending] = await transaction
    .select({
      id: pushEvents.id,
      titleLocKey: pushEvents.titleLocKey,
      payload: pushEvents.payload,
    })
    .from(pushEvents)
    .where(
      and(
        eq(pushEvents.userid, input.userid),
        eq(pushEvents.type, REACTION_RECEIVED_EVENT_TYPE),
        eq(pushEvents.status, 'pending'),
        sql`${pushEvents.availableAt} > now()`,
        sql`${pushEvents.payload}->>'roteId' = ${input.roteId}`
      )
    )
    .limit(1);

  const hasDetailedContext =
    input.reactionType !== undefined &&
    input.actorKey !== undefined &&
    input.noteContent !== undefined &&
    canPresentDetailedReactionType(input.reactionType);
  if (pending?.titleLocKey === 'push.reaction.title') return;
  if (pending && !hasDetailedContext) {
    await transaction
      .update(pushEvents)
      .set({
        titleLocKey: 'push.reaction.title',
        bodyLocKey: 'push.reaction.body',
        payload: { roteId: input.roteId },
        updatedAt: new Date(),
      })
      .where(eq(pushEvents.id, pending.id));
    return;
  }

  let presentation:
    | {
        titleLocKey: string;
        bodyLocKey: string;
        titleLocArgs: string[];
        bodyLocArgs: string[];
        state: ReturnType<typeof mergeReactionNotificationState>;
      }
    | undefined;
  if (hasDetailedContext) {
    const currentMetadata = readPushPayloadMetadata(pending?.payload);
    const state = mergeReactionNotificationState(
      parseReactionNotificationState(currentMetadata.reaction),
      {
        actorKey: input.actorKey!,
        actorName: input.actorName,
        sender: input.sender,
        reactionType: input.reactionType!,
        noteLabel: reactionNoteLabel(input.noteTitle, input.noteContent!),
      }
    );
    presentation = { ...reactionNotificationPresentation(state), state };
  }

  if (pending && presentation) {
    const currentMetadata = readPushPayloadMetadata(pending.payload);
    await transaction
      .update(pushEvents)
      .set({
        titleLocKey: presentation.titleLocKey,
        bodyLocKey: presentation.bodyLocKey,
        payload: withPushPayloadMetadata(
          {
            roteId: input.roteId,
            ...(presentation.state.sender
              ? {
                  eventType: REACTION_RECEIVED_EVENT_TYPE,
                  recipientId: input.userid,
                  sender: presentation.state.sender,
                }
              : {}),
          },
          {
            ...currentMetadata,
            titleLocArgs: presentation.titleLocArgs,
            bodyLocArgs: presentation.bodyLocArgs,
            reaction: presentation.state,
          }
        ),
        updatedAt: new Date(),
      })
      .where(eq(pushEvents.id, pending.id));
    return;
  }

  const payload = presentation
    ? withPushPayloadMetadata(
        {
          roteId: input.roteId,
          ...(presentation.state.sender
            ? {
                eventType: REACTION_RECEIVED_EVENT_TYPE,
                recipientId: input.userid,
                sender: presentation.state.sender,
              }
            : {}),
        },
        {
          titleLocArgs: presentation.titleLocArgs,
          bodyLocArgs: presentation.bodyLocArgs,
          reaction: presentation.state,
        }
      )
    : { roteId: input.roteId };

  await transaction.insert(pushEvents).values({
    userid: input.userid,
    type: REACTION_RECEIVED_EVENT_TYPE,
    category: 'reactions',
    dedupeKey: `reaction:${input.roteId}:${randomUUID()}`,
    titleLocKey: presentation?.titleLocKey ?? 'push.reaction.title',
    bodyLocKey: presentation?.bodyLocKey ?? 'push.reaction.body',
    route: `rote://detail?id=${input.roteId}`,
    payload,
    availableAt: new Date(now.getTime() + 30_000),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });
}

export async function enqueueAggregatedReactionPushEvent(input: {
  userid: string;
  roteId: string;
  reactionType?: string;
  actorKey?: string;
  actorName?: string;
  sender?: ReactionNotificationSender;
  noteTitle?: string | null;
  noteContent?: string;
}): Promise<void> {
  await db.transaction(async (transaction) => {
    await enqueueAggregatedReactionPushEventInTransaction(transaction, input);
  });
}
