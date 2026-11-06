import { describe, expect, test } from 'bun:test';
import { NoteCreateZod, NoteUpdateZod, RegisterDataZod, UsernameZod } from './zod';

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

  test('rejects empty note content on create and update', () => {
    for (const content of ['', '   ']) {
      expect(() => NoteCreateZod.parse({ content })).toThrow('Content cannot be empty');
      expect(() => NoteUpdateZod.parse({ content })).toThrow('Content cannot be empty');
    }
  });
});

describe('registration method contracts', () => {
  test('requires email and password for traditional registration without requiring nickname', () => {
    expect(RegisterDataZod.safeParse({ username: 'new-user' }).success).toBe(false);
    expect(
      RegisterDataZod.safeParse({ username: 'new-user', email: 'user@example.test' }).success
    ).toBe(false);
    expect(
      RegisterDataZod.safeParse({
        username: 'new-user',
        email: 'user@example.test',
        password: 'secret123',
      }).success
    ).toBe(true);
  });
  test('shares reserved route and username rules across registration methods', () => {
    for (const username of ['', 'has space', 'x'.repeat(21), 'login']) {
      expect(UsernameZod.safeParse(username).success).toBe(false);
    }
  });
});
