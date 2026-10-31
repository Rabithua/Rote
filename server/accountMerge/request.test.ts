import { describe, expect, it } from 'bun:test';
import { parseOAuthMergeRequest } from './request';

describe('OAuth account merge request contract', () => {
  const source = '10000000-0000-4000-8000-000000000001';

  it('preserves provider-specific legacy fields without accepting client identity metadata', () => {
    expect(
      parseOAuthMergeRequest(
        {
          existingUserId: source,
          githubUserId: '123',
          githubUsername: 'untrusted',
          role: 'super_admin',
        },
        'github'
      )
    ).toEqual({ sourceUserId: source, providerId: '123' });
    expect(
      parseOAuthMergeRequest({ existingUserId: source, appleUserId: 'subject' }, 'apple')
    ).toEqual({ sourceUserId: source, providerId: 'subject' });
  });

  it('rejects missing, malformed and cross-provider identity representations', () => {
    for (const body of [
      null,
      [],
      'body',
      {},
      { existingUserId: 'other', githubUserId: '1' },
      { existingUserId: source, githubUserId: 1 },
      { existingUserId: source, githubUserId: '' },
      { existingUserId: source, githubUserId: 'x'.repeat(256) },
      { existingUserId: source, appleUserId: 'subject' },
    ]) {
      expect(parseOAuthMergeRequest(body, 'github')).toBeNull();
    }
  });
});
