import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';
import { OAUTH_SCOPE_GROUPS } from './authorize';

describe('OAuth share permission presentation', () => {
  it('groups notes:share with note permissions', () => {
    expect(OAUTH_SCOPE_GROUPS.find((group) => group.key === 'notes')?.scopes).toContain(
      'notes:share'
    );
  });

  it('localizes the OAuth scope and OpenKey permission in every supported web locale', () => {
    for (const locale of [en, zh, ja]) {
      expect(locale.pages.oauthAuthorize.scopes.notes_share).toBeTruthy();
      expect(locale.components.openKeyEditModel.permissions.SHAREROTE).toBeTruthy();
    }
  });
});
