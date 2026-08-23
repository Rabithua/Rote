import { describe, expect, test } from 'bun:test';
import { NoteCreateZod, NoteUpdateZod } from './zod';

describe('note contract compatibility', () => {
  test('strips the legacy type field from create input', () => {
    const input = NoteCreateZod.parse({
      content: 'legacy client payload',
      type: 'legacy-custom-type',
    });

    expect(input).toEqual({ content: 'legacy client payload' });
    expect('type' in input).toBe(false);
  });

  test('strips the legacy type field from update input', () => {
    const input = NoteUpdateZod.parse({
      title: 'updated title',
      type: 'legacy-custom-type',
    });

    expect(input).toEqual({ title: 'updated title' });
    expect('type' in input).toBe(false);
  });
});
