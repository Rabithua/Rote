import { describe, expect, test } from 'bun:test';
import { hashImportedSource, hashManagedNote } from './importHash';

describe('import hashes', () => {
  test('ignores generated timestamps while detecting managed note edits', () => {
    const base = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'hello',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    expect(hashManagedNote(base)).toBe(
      hashManagedNote({ ...base, createdAt: '2026-01-01T00:00:00.000Z' })
    );
    expect(hashManagedNote(base)).not.toBe(hashManagedNote({ ...base, content: 'edited' }));
  });

  test('ignores volatile attachment mtimes but detects source attachment changes', () => {
    const source = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'hello',
      attachments: [
        {
          url: 'https://example.com/a.png',
          storage: 'REMOTE',
          details: { key: 'a.png', size: 10, mimetype: 'image/png', mtime: 'first' },
        },
      ],
    };

    expect(hashImportedSource(source)).toBe(
      hashImportedSource({
        ...source,
        attachments: [
          {
            ...source.attachments[0],
            details: { ...source.attachments[0].details, mtime: 'second' },
          },
        ],
      })
    );
    expect(hashImportedSource(source)).not.toBe(
      hashImportedSource({
        ...source,
        attachments: [{ ...source.attachments[0], url: 'https://example.com/b.png' }],
      })
    );
  });
});
