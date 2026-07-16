import { describe, expect, test } from 'bun:test';
import { parseImportPayload } from './importSchema';

const note = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  content: 'hello',
  source: {
    provider: 'memos',
    accountId: 'account',
    externalId: 'memo-1',
    sourceUpdatedAt: '2026-07-16T00:00:00.000Z',
  },
};

describe('import payload validation', () => {
  test('accepts migration protocol v2 and applies safe defaults', () => {
    const payload = parseImportPayload({ formatVersion: 2, notes: [note] });

    expect(payload.importOptions).toEqual({
      existingStrategy: 'skip',
      visibilityStrategy: 'preserve',
    });
  });

  test('rejects duplicate source identities before any database writes', () => {
    expect(() =>
      parseImportPayload({
        formatVersion: 2,
        notes: [note, { ...note, id: '660e8400-e29b-41d4-a716-446655440000' }],
      })
    ).toThrow('duplicate source identity');
  });

  test('keeps source tuples containing separators distinct', () => {
    const payload = parseImportPayload({
      formatVersion: 2,
      notes: [
        { ...note, source: { provider: 'memos', accountId: 'a:b', externalId: 'c' } },
        {
          ...note,
          id: '660e8400-e29b-41d4-a716-446655440000',
          source: { provider: 'memos', accountId: 'a', externalId: 'b:c' },
        },
      ],
    });

    expect(payload.notes).toHaveLength(2);
  });

  test('keeps legacy payloads compatible', () => {
    const payload = parseImportPayload({
      notes: [{ id: note.id, content: 'legacy note' }],
    });

    expect(payload.formatVersion).toBeUndefined();
    expect(payload.notes[0].source).toBeUndefined();
  });
});
