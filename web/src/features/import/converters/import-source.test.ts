import { describe, expect, it } from 'vitest';

import { createImportSource, dedupeNotesBySource } from './import-source';
import type { RoteNote } from './types';

describe('import source identities', () => {
  it('creates stable, account-scoped identities', () => {
    const first = createImportSource({
      provider: 'memos',
      accountKey: 'https://memos.example.com',
      externalKey: 'memos/1',
    });
    const repeated = createImportSource({
      provider: 'memos',
      accountKey: 'https://memos.example.com',
      externalKey: 'memos/1',
    });
    const otherAccount = createImportSource({
      provider: 'memos',
      accountKey: 'https://other.example.com',
      externalKey: 'memos/1',
    });

    expect(repeated).toEqual(first);
    expect(otherAccount.accountId).not.toBe(first.accountId);
    expect(otherAccount.externalId).not.toBe(first.externalId);
  });

  it('does not confuse tuples containing separators', () => {
    const first = createNote('a:b', 'c');
    const second = createNote('a', 'b:c');

    expect(dedupeNotesBySource([first, second])).toHaveLength(2);
  });

  it('keeps the newest duplicate from a conversion batch', () => {
    const older = createNote('account', 'same', '2026-01-01T00:00:00.000Z');
    const newer = createNote('account', 'same', '2026-02-01T00:00:00.000Z');

    expect(dedupeNotesBySource([older, newer])).toEqual([newer]);
  });
});

function createNote(
  accountId: string,
  externalId: string,
  updatedAt = '2026-07-16T00:00:00.000Z'
): RoteNote {
  return {
    id: crypto.randomUUID(),
    title: '',
    type: 'Rote',
    tags: [],
    content: 'content',
    state: 'private',
    archived: false,
    authorid: 'author',
    articleId: null,
    pin: false,
    editor: 'normal',
    createdAt: updatedAt,
    updatedAt,
    author: { username: 'author', nickname: 'author', avatar: null },
    attachments: [],
    reactions: [],
    source: {
      provider: 'memos',
      accountId,
      externalId,
      sourceUpdatedAt: updatedAt,
    },
  };
}
