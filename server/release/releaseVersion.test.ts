import { describe, expect, it } from 'bun:test';
import { getReleaseVersion, UNKNOWN_RELEASE_VERSION } from './releaseVersion';

describe('server release version', () => {
  it('reports an injected stable release tag unchanged', () => {
    expect(getReleaseVersion({ ROTE_RELEASE_VERSION: 'v2.2.0' })).toBe('v2.2.0');
  });

  it('keeps development build identifiers distinct from stable tags', () => {
    expect(getReleaseVersion({ ROTE_RELEASE_VERSION: 'dev-v2.2.0-3-g1a2b3c4' })).toBe(
      'dev-v2.2.0-3-g1a2b3c4'
    );
  });

  it('trims injected values and uses a non-semver fallback for local builds', () => {
    expect(getReleaseVersion({ ROTE_RELEASE_VERSION: '  v2.2.0  ' })).toBe('v2.2.0');
    expect(getReleaseVersion({ ROTE_RELEASE_VERSION: '   ' })).toBe(UNKNOWN_RELEASE_VERSION);
    expect(getReleaseVersion({})).toBe(UNKNOWN_RELEASE_VERSION);
  });
});
