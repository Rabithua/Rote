import { describe, expect, test } from 'bun:test';
import { parseOpenKeyImport } from './openKeyImportPolicy';

const note = {
  id: '10000000-0000-4000-8000-000000000003',
  content: 'historic',
  createdAt: '2020-01-01T00:00:00Z',
  source: { provider: 'dinox', accountId: 'account', externalId: 'item' },
};
const permissions = ['SENDROTE', 'GETROTE'];

describe('OpenKey formal import authorization', () => {
  test('defaults to private and skip and keeps historical time and source', () => {
    const result = parseOpenKeyImport({ notes: [note] }, permissions);
    expect(result.importOptions).toEqual({
      existingStrategy: 'skip',
      visibilityStrategy: 'private',
    });
    expect(result.notes[0].createdAt).toBe(note.createdAt);
    expect(result.notes[0].source).toEqual(note.source);
  });
  test('requires read and create permissions for plan and commit', () => {
    for (const planning of [true, false]) {
      expect(() => parseOpenKeyImport({ notes: [note] }, ['SENDROTE'], planning)).toThrow(
        'GETROTE'
      );
      expect(() => parseOpenKeyImport({ notes: [note] }, ['GETROTE'], planning)).toThrow(
        'SENDROTE'
      );
    }
  });
  test('overwrite is explicitly selected and requires EDITROTE', () => {
    const input = { notes: [note], importOptions: { existingStrategy: 'overwrite' } };
    expect(() => parseOpenKeyImport(input, permissions, true)).toThrow('EDITROTE');
    expect(
      parseOpenKeyImport(input, [...permissions, 'EDITROTE']).importOptions.existingStrategy
    ).toBe('overwrite');
  });
  test('enforces the 50 note boundary and guards article upserts', () => {
    const notes = Array.from({ length: 51 }, (_, i) => ({
      ...note,
      source: { ...note.source, externalId: String(i) },
    }));
    expect(() => parseOpenKeyImport({ notes }, permissions)).toThrow('import_batch_limit:50');
    expect(() =>
      parseOpenKeyImport({ notes: [note], articles: [{ id: note.id, content: 'article' }] }, [
        ...permissions,
        'SENDARTICLE',
      ])
    ).toThrow('EDITARTICLE');
  });
  test('planning can precede uploads while commit requires upload permission', () => {
    const input = {
      notes: [
        {
          ...note,
          attachments: [{ url: 'https://example.test/image.webp', storage: 'R2', details: {} }],
        },
      ],
    };
    expect(() => parseOpenKeyImport(input, permissions, true)).not.toThrow();
    expect(() => parseOpenKeyImport(input, permissions)).toThrow('UPLOADATTACHMENT');
  });
  test('video and live photo metadata require UPLOADVIDEO at commit, while plan stays metadata-only', () => {
    for (const details of [
      { mimetype: 'video/mp4' },
      { mediaKind: 'video' },
      { mediaKind: 'image', mimetype: 'video/webm' },
      { mediaKind: 'livePhoto' },
      { mimetype: 'image/jpeg', pairedVideoKey: 'paired.mov' },
    ]) {
      const input = {
        notes: [
          {
            ...note,
            attachments: [{ url: 'https://fixture.test/media', storage: 'REMOTE', details }],
          },
        ],
      };
      expect(() => parseOpenKeyImport(input, permissions, true)).not.toThrow();
      expect(() => parseOpenKeyImport(input, [...permissions, 'UPLOADATTACHMENT'])).toThrow(
        'UPLOADVIDEO'
      );
      expect(() =>
        parseOpenKeyImport(input, [...permissions, 'UPLOADATTACHMENT', 'UPLOADVIDEO'])
      ).not.toThrow();
    }
  });
});
