import { v5 as uuidv5 } from 'uuid';

import type { ImportProvider, RoteImportSource, RoteNote } from './types';

const REROTE_IMPORT_NAMESPACE = 'b16f48bc-4fb8-5a62-95e9-dc1b0c62f034';

export function createImportSource({
  provider,
  accountKey,
  externalKey,
  sourceUpdatedAt,
}: {
  provider: ImportProvider;
  accountKey: string;
  externalKey: string;
  sourceUpdatedAt?: string;
}): RoteImportSource {
  const normalizedAccount = accountKey.trim() || 'default';
  const accountId = stableSourceId(provider, 'account', normalizedAccount);

  return {
    provider,
    accountId,
    externalId: stableSourceId(provider, 'item', normalizedAccount, externalKey),
    ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
  };
}

export function createAttachmentSource(
  noteSource: RoteImportSource,
  externalKey: string
): RoteImportSource {
  return {
    provider: noteSource.provider,
    accountId: noteSource.accountId,
    externalId: stableSourceId(
      noteSource.provider,
      'attachment',
      noteSource.accountId,
      noteSource.externalId,
      externalKey
    ),
  };
}

export function stableSourceId(...parts: Array<string>): string {
  return uuidv5(JSON.stringify(parts), REROTE_IMPORT_NAMESPACE);
}

export function dedupeNotesBySource(notes: Array<RoteNote>): Array<RoteNote> {
  const unique = new Map<string, RoteNote>();

  for (const note of notes) {
    const source = note.source;
    const key = JSON.stringify([source.provider, source.accountId, source.externalId]);
    const existing = unique.get(key);
    if (!existing || isNewer(note, existing)) unique.set(key, note);
  }

  return [...unique.values()];
}

function isNewer(candidate: RoteNote, existing: RoteNote): boolean {
  const candidateTime = Date.parse(candidate.source.sourceUpdatedAt ?? candidate.updatedAt);
  const existingTime = Date.parse(existing.source.sourceUpdatedAt ?? existing.updatedAt);

  return (
    Number.isFinite(candidateTime) &&
    (!Number.isFinite(existingTime) || candidateTime >= existingTime)
  );
}
