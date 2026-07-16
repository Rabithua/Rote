import { createHash } from 'crypto';
import type { ImportAttachment, ImportNote } from './importSchema';

type ManagedNote = Pick<
  ImportNote,
  'archived' | 'content' | 'editor' | 'pin' | 'state' | 'tags' | 'title' | 'type'
>;

export function hashImportedSource(note: ImportNote): string {
  return hashValue({
    note: managedNoteValue(note),
    sourceUpdatedAt: note.source?.sourceUpdatedAt ?? null,
    attachments: (note.attachments ?? []).map(managedAttachmentValue),
  });
}

export function hashManagedNote(note: ManagedNote): string {
  return hashValue(managedNoteValue(note));
}

export function fallbackAttachmentExternalId(attachment: ImportAttachment, index: number): string {
  return hashValue({ index, ...managedAttachmentValue(attachment) });
}

function managedNoteValue(note: ManagedNote) {
  return {
    title: note.title ?? '',
    type: note.type ?? 'Rote',
    tags: note.tags ?? [],
    content: note.content,
    state: note.state ?? 'private',
    archived: note.archived ?? false,
    pin: note.pin ?? false,
    editor: note.editor ?? 'normal',
  };
}

function managedAttachmentValue(attachment: ImportAttachment) {
  return {
    url: attachment.url,
    compressUrl: attachment.compressUrl ?? '',
    posterUrl: attachment.posterUrl ?? '',
    storage: attachment.storage,
    details: {
      key: attachment.details.key ?? null,
      size: attachment.details.size ?? null,
      mimetype: attachment.details.mimetype ?? null,
      compressKey: attachment.details.compressKey ?? null,
    },
    sortIndex: attachment.sortIndex ?? 0,
    externalId: attachment.source?.externalId ?? null,
  };
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
