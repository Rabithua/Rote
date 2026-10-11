import { z } from 'zod';
import type { AiConversationWrite } from './types';

export const AI_CONVERSATION_MAX_BYTES = 8 * 1024 * 1024;
export const AI_CONVERSATION_MAX_MESSAGES = 2000;
const text = z.string().max(1024 * 1024);
export const conversationIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\x21-\x7e]+$/);
const date = z.iso.datetime().transform((value) => new Date(value).toISOString());
const label = z.string().max(160);
const retrieval = z.object({
  foundCount: z.number().int().nonnegative(),
  addedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  budgetExhausted: z.boolean(),
});
const timeline = z.strictObject({
  id: conversationIdSchema,
  type: z.enum(['progress', 'tool']),
  phase: label.optional(),
  toolName: label.optional(),
  toolStatus: label.optional(),
  message: text.optional(),
  status: z.enum(['running', 'done', 'error']),
  updatedAt: date,
  retrieval: retrieval.optional(),
});
const usage = z.object({
  prompt_tokens: z.number().nonnegative(),
  completion_tokens: z.number().nonnegative(),
  total_tokens: z.number().nonnegative(),
});
const source = z.object({
  id: z.string().max(160).optional(),
  ownerId: z.string().max(160).optional(),
  sourceType: z.enum(['rote', 'article']),
  sourceId: conversationIdSchema,
  chunkIndex: z.number().int().nonnegative().optional(),
  text: text.optional(),
  preview: text.optional(),
  similarity: z.number(),
  retrievalMode: z.enum(['relevance', 'recent']).optional(),
  metadata: z.record(z.string(), z.unknown()),
});
// Planner DTOs are display/context snapshots, never an authorization source.
// Preserve their existing extensible metadata while validating the envelope.
const planner = z.record(z.string(), z.unknown()).nullable();
const message = z.strictObject({
  id: conversationIdSchema,
  role: z.enum(['user', 'assistant']),
  content: text,
  createdAt: date,
  error: z.boolean().optional(),
  errorDetail: text.optional(),
  clarification: z.boolean().optional(),
  sources: z.array(source).max(500).optional(),
  retrieval: retrieval.optional(),
  plan: planner.optional(),
  pendingPlan: planner.optional(),
  thinking: z.record(label, text).optional(),
  outputs: z
    .array(
      z.strictObject({
        id: conversationIdSchema,
        phase: label,
        text: text.optional(),
        thinking: text.optional(),
        thinkingPhase: label.optional(),
        kind: z.enum(['process', 'answer']).optional(),
        status: timeline.optional(),
      })
    )
    .max(1000)
    .optional(),
  timeline: z.array(timeline).max(2000).optional(),
  metrics: z
    .object({
      planTime: z.number().nonnegative().optional(),
      sourcesTime: z.number().nonnegative().optional(),
      firstTokenTime: z.number().nonnegative().optional(),
      totalTime: z.number().nonnegative().optional(),
      usage: usage.optional(),
      usageByPhase: z
        .object({
          planning: usage.optional(),
          tool_decision: usage.optional(),
          answer: usage.optional(),
        })
        .optional(),
    })
    .optional(),
  saved: z.boolean().optional(),
});

const writeSchema = z
  .strictObject({
    baseRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    createdAt: date,
    agentConversationId: conversationIdSchema.optional(),
    messages: z.array(message).max(AI_CONVERSATION_MAX_MESSAGES),
  })
  .refine(
    (value) => new Set(value.messages.map((entry) => entry.id)).size === value.messages.length
  );

export function parseAiConversationWrite(value: unknown): AiConversationWrite | null {
  const result = writeSchema.safeParse(value);
  return result.success ? (result.data as AiConversationWrite) : null;
}

export function parseAiConversationRevision(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : null;
}
