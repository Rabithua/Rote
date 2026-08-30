import { z } from 'zod';

const importSourceSchema = z.object({
  provider: z.string().trim().min(1).max(50),
  accountId: z.string().trim().min(1).max(100),
  externalId: z.string().trim().min(1).max(100),
  sourceUpdatedAt: z.iso.datetime().optional(),
});

export const attachmentSchema = z
  .object({
    id: z.uuid().optional(),
    url: z.string().min(1),
    compressUrl: z.string().optional(),
    posterUrl: z.string().optional(),
    storage: z.string().min(1).max(100),
    details: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
    sortIndex: z.number().int().optional(),
    source: importSourceSchema.optional(),
  })
  .passthrough();

export const attachmentMigrationAuthSchema = z
  .object({
    provider: z.literal('memos'),
    baseUrl: z.url(),
  })
  .optional();

const noteSchema = z
  .object({
    id: z.uuid(),
    title: z.string().optional(),
    tags: z.array(z.string()).max(100).optional(),
    content: z.string(),
    state: z.string().max(50).optional(),
    archived: z.boolean().optional(),
    articleId: z.uuid().nullable().optional(),
    pin: z.boolean().optional(),
    editor: z.string().max(100).optional(),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
    attachments: z.array(attachmentSchema).max(500).optional(),
    source: importSourceSchema.optional(),
  })
  .passthrough();

const articleSchema = z
  .object({
    id: z.uuid(),
    content: z.string(),
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
  })
  .passthrough();

export const importPayloadSchema = z
  .object({
    formatVersion: z.literal(2).optional(),
    notes: z.array(noteSchema).max(20_000),
    articles: z.array(articleSchema).max(5_000).optional().default([]),
    importOptions: z
      .object({
        existingStrategy: z.enum(['skip', 'overwrite']).optional().default('skip'),
        visibilityStrategy: z.enum(['private', 'preserve']).optional().default('preserve'),
      })
      .optional()
      .default({ existingStrategy: 'skip', visibilityStrategy: 'preserve' }),
  })
  .superRefine((payload, context) => {
    const noteIds = new Set<string>();
    const sourceKeys = new Set<string>();

    payload.notes.forEach((note, index) => {
      if (!note.source) {
        if (noteIds.has(note.id)) {
          context.addIssue({
            code: 'custom',
            path: ['notes', index, 'id'],
            message: 'duplicate legacy note ID',
          });
        }
        noteIds.add(note.id);
        return;
      }

      const sourceKey = JSON.stringify([
        note.source.provider,
        note.source.accountId,
        note.source.externalId,
      ]);
      if (sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: 'custom',
          path: ['notes', index, 'source'],
          message: 'duplicate source identity',
        });
      }
      sourceKeys.add(sourceKey);

      const attachmentSourceKeys = new Set<string>();
      (note.attachments ?? []).forEach((attachment, attachmentIndex) => {
        if (!attachment.source) return;
        const attachmentSourceKey = JSON.stringify([
          attachment.source.provider,
          attachment.source.accountId,
          attachment.source.externalId,
        ]);
        if (attachmentSourceKeys.has(attachmentSourceKey)) {
          context.addIssue({
            code: 'custom',
            path: ['notes', index, 'attachments', attachmentIndex, 'source'],
            message: 'duplicate attachment source identity',
          });
        }
        attachmentSourceKeys.add(attachmentSourceKey);
      });
    });
  });

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type ImportNote = ImportPayload['notes'][number];
export type ImportAttachment = NonNullable<ImportNote['attachments']>[number];
export type ImportSource = NonNullable<ImportNote['source']>;

export function parseImportPayload(data: unknown): ImportPayload {
  const result = importPayloadSchema.safeParse(data);
  if (result.success) return result.data;

  const firstIssue = result.error.issues[0];
  const path = firstIssue?.path.join('.') || 'payload';
  throw new Error(`Invalid import data at ${path}: ${firstIssue?.message || 'validation failed'}`);
}
