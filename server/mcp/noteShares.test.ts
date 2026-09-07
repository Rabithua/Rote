import { describe, expect, it } from 'bun:test';
import { DEFAULT_OAUTH_MCP_SCOPES } from '../oauth/scopes';
import { createMcpNoteShare } from '../noteShares/mcpService';
import { normalizeFrontendOrigin, presentNoteShare } from '../noteShares/urls';
import { getToolsForScopes } from './tools';

describe('MCP note-share contract', () => {
  it('exposes share tools only for the dedicated non-default scope', () => {
    expect(DEFAULT_OAUTH_MCP_SCOPES).not.toContain('notes:share');
    const withoutShare = getToolsForScopes(['notes:read', 'notes:write']).map((tool) => tool.name);
    expect(withoutShare).not.toContain('notes_share_get');

    const withShare = getToolsForScopes(['notes:share']).map((tool) => tool.name);
    for (const tool of ['notes_share_get', 'notes_share_create', 'notes_share_revoke']) {
      expect(withShare).toContain(tool);
    }
  });

  it('uses the configured HTTP origin and preserves self-hosted ports', () => {
    expect(normalizeFrontendOrigin('https://notes.example.test/')).toBe(
      'https://notes.example.test'
    );
    expect(normalizeFrontendOrigin('http://localhost:4321')).toBe('http://localhost:4321');
    expect(normalizeFrontendOrigin('https://notes.example.test/path/')).toBeNull();
    expect(normalizeFrontendOrigin('https://notes.example.test/?source=config')).toBeNull();
    expect(normalizeFrontendOrigin('https://notes.example.test/#share')).toBeNull();
    expect(normalizeFrontendOrigin('ftp://notes.example.test')).toBeNull();
    expect(normalizeFrontendOrigin('https://user:secret@notes.example.test')).toBeNull();
    expect(normalizeFrontendOrigin('not-a-url')).toBeNull();
  });

  it('presents inactive, resolved, and unresolved share states explicitly', () => {
    expect(presentNoteShare(null, null)).toEqual({ active: false });
    const share = { token: 'share-token', createdAt: new Date('2026-09-07T00:00:00Z') };
    expect(presentNoteShare(share, null)).toEqual({
      active: true,
      token: 'share-token',
      createdAt: share.createdAt,
      url: null,
    });
    expect(presentNoteShare(share, 'https://notes.example.test')).toEqual({
      active: true,
      token: 'share-token',
      createdAt: share.createdAt,
      url: 'https://notes.example.test/s/share-token',
    });
  });

  it('fails before persistence when the frontend origin is unavailable', async () => {
    await expect(createMcpNoteShare('owner-not-queried', 'note-not-queried', null)).rejects.toThrow(
      'share_frontend_unavailable'
    );
  });
});
