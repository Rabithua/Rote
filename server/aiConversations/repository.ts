import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { aiConversations, users } from '../drizzle/schema';
import db from '../utils/drizzle';
import type { AiConversation, AiConversationWrite } from './types';

type ConversationRow = typeof aiConversations.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AiConversationMutation =
  | { kind: 'saved'; conversation: AiConversation }
  | { kind: 'conflict'; conversation: AiConversation }
  | { kind: 'not_found' };

export interface AiConversationPage {
  conversations: AiConversation[];
  nextCursor: string | null;
}

interface ActivityCursor {
  updatedAt: string;
  id: string;
}

export class InvalidAiConversationCursor extends Error {
  constructor() {
    super('ai_conversation_invalid_cursor');
    this.name = 'InvalidAiConversationCursor';
  }
}

function toConversation(row: ConversationRow): AiConversation {
  return {
    id: row.id,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    ...(row.agentConversationId === null ? {} : { agentConversationId: row.agentConversationId }),
    messages: row.messages,
  };
}

function decodeCursor(cursor: string): ActivityCursor {
  if (!/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) throw new InvalidAiConversationCursor();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidAiConversationCursor();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidAiConversationCursor();
  }
  const parsed = value as Partial<ActivityCursor>;
  if (
    typeof parsed.id !== 'string' ||
    !/^[\x21-\x7e]{1,160}$/.test(parsed.id) ||
    typeof parsed.updatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.updatedAt) ||
    !Number.isFinite(Date.parse(parsed.updatedAt)) ||
    new Date(parsed.updatedAt).toISOString() !== parsed.updatedAt
  ) {
    throw new InvalidAiConversationCursor();
  }
  return { id: parsed.id, updatedAt: parsed.updatedAt };
}

export async function listAiConversations(
  ownerId: string,
  options: { limit?: number; cursor?: string | null } = {}
): Promise<AiConversationPage> {
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 20)));
  const cursor =
    options.cursor === undefined || options.cursor === null ? null : decodeCursor(options.cursor);
  const rows = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.ownerId, ownerId),
        cursor
          ? or(
              lt(aiConversations.updatedAt, new Date(cursor.updatedAt)),
              and(
                eq(aiConversations.updatedAt, new Date(cursor.updatedAt)),
                lt(aiConversations.id, cursor.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(limit + 1);
  const conversations = rows.slice(0, limit).map(toConversation);
  const last = conversations[conversations.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt, id: last.id })).toString(
          'base64url'
        )
      : null;
  return { conversations, nextCursor };
}

export async function findAiConversation(
  ownerId: string,
  id: string
): Promise<AiConversation | null> {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id)))
    .limit(1);
  return row ? toConversation(row) : null;
}

async function lockConversation(
  transaction: Transaction,
  ownerId: string,
  id: string
): Promise<boolean> {
  // Account merge/deletion locks users FOR UPDATE. KEY SHARE keeps this write
  // attached to a live account while allowing unrelated conversation writes.
  const [owner] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, ownerId))
    .for('key share');
  if (!owner) return false;
  // A row lock alone cannot serialize two creates before the row exists.
  await transaction.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['ai_conversation', ownerId, id])}, 0))`
  );
  return true;
}

export async function putAiConversation(
  ownerId: string,
  id: string,
  input: AiConversationWrite
): Promise<AiConversationMutation> {
  return db.transaction(async (transaction): Promise<AiConversationMutation> => {
    if (!(await lockConversation(transaction, ownerId, id))) return { kind: 'not_found' };
    const [current] = await transaction
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id)))
      .for('update');
    if (!current) {
      if (input.baseRevision !== null) return { kind: 'not_found' };
      const [created] = await transaction
        .insert(aiConversations)
        .values({
          ownerId,
          id,
          createdAt: new Date(input.createdAt),
          agentConversationId: input.agentConversationId ?? null,
          messages: input.messages,
        })
        .returning();
      return { kind: 'saved', conversation: toConversation(created) };
    }

    const conversation = toConversation(current);
    if (
      current.deletedAt !== null ||
      input.baseRevision === null ||
      input.baseRevision > current.revision ||
      current.createdAt.getTime() !== Date.parse(input.createdAt)
    ) {
      return { kind: 'conflict', conversation };
    }
    if (
      current.agentConversationId === (input.agentConversationId ?? null) &&
      isDeepStrictEqual(current.messages, input.messages)
    ) {
      return { kind: 'saved', conversation };
    }
    if (input.baseRevision !== current.revision) return { kind: 'conflict', conversation };

    const [updated] = await transaction
      .update(aiConversations)
      .set({
        revision: current.revision + 1,
        updatedAt: new Date(),
        agentConversationId: input.agentConversationId ?? null,
        messages: input.messages,
      })
      .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id)))
      .returning();
    return { kind: 'saved', conversation: toConversation(updated) };
  });
}

export async function deleteAiConversation(
  ownerId: string,
  id: string,
  baseRevision: number
): Promise<AiConversationMutation> {
  return db.transaction(async (transaction): Promise<AiConversationMutation> => {
    if (!(await lockConversation(transaction, ownerId, id))) return { kind: 'not_found' };
    const [current] = await transaction
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id)))
      .for('update');
    if (!current) return { kind: 'not_found' };
    const conversation = toConversation(current);
    if (current.deletedAt !== null) return { kind: 'saved', conversation };
    if (baseRevision !== current.revision) return { kind: 'conflict', conversation };
    const now = new Date();
    const [deleted] = await transaction
      .update(aiConversations)
      .set({
        revision: current.revision + 1,
        updatedAt: now,
        deletedAt: now,
        agentConversationId: null,
        messages: [],
      })
      .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id)))
      .returning();
    return { kind: 'saved', conversation: toConversation(deleted) };
  });
}

/** The caller holds both user rows FOR UPDATE throughout the account merge. */
export async function mergeAiConversationOwnership(
  transaction: Transaction,
  sourceOwnerId: string,
  targetOwnerId: string
): Promise<number> {
  const sourceRows = await transaction
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(eq(aiConversations.ownerId, sourceOwnerId))
    .for('update');
  const targetRows = await transaction
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(eq(aiConversations.ownerId, targetOwnerId));
  const targetIds = new Set(targetRows.map((row) => row.id));
  for (const source of sourceRows) {
    let id = source.id;
    // The opaque ID belongs to an account. Keep both snapshots on collision,
    // including tombstones, without overwriting the target account's history.
    while (targetIds.has(id)) id = randomUUID();
    await transaction
      .update(aiConversations)
      .set({ ownerId: targetOwnerId, id })
      .where(and(eq(aiConversations.ownerId, sourceOwnerId), eq(aiConversations.id, source.id)));
    targetIds.add(id);
  }
  return sourceRows.length;
}
