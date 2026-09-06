import { randomBytes } from 'node:crypto';
import { and, eq, exists } from 'drizzle-orm';
import { noteShareLinks, rotes } from '../drizzle/schema';
import db from '../utils/drizzle';
import { sharedAttachmentDetails } from './presentation';

export class ShareNoteNotFound extends Error {
  constructor() {
    super('share_not_found');
  }
}

type ShareOperation = 'read' | 'create' | 'revoke';

export async function manageNoteShare(ownerId: string, noteId: string, operation: ShareOperation) {
  return db.transaction(async (transaction) => {
    // Lock the parent row even before the first share exists. Creation,
    // revocation and deletion of the note therefore have a definite order.
    const [note] = await transaction
      .select({ id: rotes.id })
      .from(rotes)
      .where(and(eq(rotes.id, noteId), eq(rotes.authorid, ownerId)))
      .for('update');
    if (!note) throw new ShareNoteNotFound();

    if (operation === 'revoke') {
      await transaction.delete(noteShareLinks).where(eq(noteShareLinks.noteId, noteId));
      return null;
    }

    const [current] = await transaction
      .select({ token: noteShareLinks.token, createdAt: noteShareLinks.createdAt })
      .from(noteShareLinks)
      .where(eq(noteShareLinks.noteId, noteId));
    if (current || operation === 'read') return current ?? null;

    const [created] = await transaction
      .insert(noteShareLinks)
      .values({ noteId, token: randomBytes(32).toString('base64url') })
      .returning({ token: noteShareLinks.token, createdAt: noteShareLinks.createdAt });
    return created;
  });
}

export async function readSharedNote(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  // The token and all content are read in one SQL statement/snapshot. A revoked
  // token cannot be used to issue a separate unrestricted note lookup.
  const note = await db.query.rotes.findFirst({
    where: exists(
      db
        .select({ noteId: noteShareLinks.noteId })
        .from(noteShareLinks)
        .where(and(eq(noteShareLinks.token, token), eq(noteShareLinks.noteId, rotes.id)))
    ),
    columns: { title: true, content: true, tags: true, createdAt: true, updatedAt: true },
    with: {
      author: { columns: { username: true, nickname: true, avatar: true } },
      article: { columns: { content: true, createdAt: true, updatedAt: true } },
      attachments: {
        columns: {
          id: true,
          url: true,
          compressUrl: true,
          posterUrl: true,
          sortIndex: true,
          details: true,
        },
        orderBy: (table, { asc }) => [asc(table.sortIndex), asc(table.createdAt)],
      },
      linkPreviews: {
        columns: {
          id: true,
          url: true,
          title: true,
          description: true,
          image: true,
          contentExcerpt: true,
        },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
  });
  if (!note) return null;

  return {
    ...note,
    attachments: note.attachments.map((attachment) => ({
      ...attachment,
      compressUrl: attachment.compressUrl ?? '',
      sortIndex: attachment.sortIndex ?? 0,
      details: sharedAttachmentDetails(attachment.details),
    })),
  };
}
