import { describe, expect, it } from 'bun:test';
import { titleForEnvelope, urlForEnvelope } from '../utils/adminHooks/presentation';
import type { AdminHookEnvelope } from '../utils/adminHooks/types';

function createUserRegisteredEnvelope(
  overrides: Partial<AdminHookEnvelope['site']> = {}
): AdminHookEnvelope {
  return {
    actor: {
      id: 'user-id',
      type: 'user',
      username: 'alice',
    },
    event: 'user.registered',
    occurredAt: '2026-07-25T00:00:00.000Z',
    site: {
      frontendUrl: 'https://rote.ink/',
      name: 'Rote',
      ...overrides,
    },
    user: {
      id: 'user-id',
      username: 'alice',
    },
  };
}

describe('admin hook envelope URLs', () => {
  it('links user registration events to the registered user profile', () => {
    const envelope = createUserRegisteredEnvelope();

    expect(urlForEnvelope(envelope)).toBe('https://rote.ink/alice');
  });

  it('encodes the username when building a user profile URL', () => {
    const envelope = createUserRegisteredEnvelope({
      frontendUrl: 'https://rote.ink',
    });
    envelope.user!.username = 'alice/test';

    expect(urlForEnvelope(envelope)).toBe('https://rote.ink/alice%2Ftest');
  });
});

describe('admin hook envelope localization', () => {
  it('uses the localized event label in the notification title', () => {
    expect(titleForEnvelope(createUserRegisteredEnvelope({ defaultLanguage: 'zh-CN' }))).toBe(
      'Rote: 新用户注册'
    );
    expect(titleForEnvelope(createUserRegisteredEnvelope({ defaultLanguage: 'en' }))).toBe(
      'Rote: New User Registration'
    );
    expect(titleForEnvelope(createUserRegisteredEnvelope({ defaultLanguage: 'ja-JP' }))).toBe(
      'Rote: 新規ユーザー登録'
    );
  });
});
