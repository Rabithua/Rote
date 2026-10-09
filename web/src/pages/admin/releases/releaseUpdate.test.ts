import { describe, expect, it } from 'vitest';
import { getReleaseUpdate, type GithubRelease } from './releaseUpdate';

const stableRelease: GithubRelease = {
  tag_name: 'v2.5.1',
  draft: false,
  prerelease: false,
};

describe('admin release update policy', () => {
  it('uses the running version and links to the detected release', () => {
    expect(getReleaseUpdate('v2.5.0', stableRelease)).toEqual({
      currentVersion: 'v2.5.0',
      latestVersion: 'v2.5.1',
      releaseUrl: 'https://github.com/Rabithua/Rote/releases/tag/v2.5.1',
    });
  });

  it.each([
    ['v2.9.9', 'v2.10.0'],
    ['v2.5.9', 'v2.5.10'],
    ['v2.99.99', 'v3.0.0'],
  ])('compares numeric version segments: %s to %s', (currentVersion, latestVersion) => {
    expect(
      getReleaseUpdate(currentVersion, { ...stableRelease, tag_name: latestVersion })?.latestVersion
    ).toBe(latestVersion);
  });

  it.each(['v2.5.1', 'v2.5.2', 'v2.6.0', 'v3.0.0'])(
    'does not suggest an equal or older release to %s',
    (currentVersion) => {
      expect(getReleaseUpdate(currentVersion, stableRelease)).toBeNull();
    }
  );

  it.each([
    undefined,
    '',
    'dev-unknown',
    'dev-v2.5.0-3-g1a2b3c4',
    'develop',
    'main',
    'latest',
    'v2.5.1-beta.1',
    'v2.6.0-rc.1',
    '2.5.0',
  ])('does not compare development, preview, or unknown builds: %s', (currentVersion) => {
    expect(getReleaseUpdate(currentVersion, stableRelease)).toBeNull();
  });

  it.each([
    { ...stableRelease, draft: true },
    { ...stableRelease, prerelease: true },
    { ...stableRelease, tag_name: 'v2.6.0-beta.1' },
    { ...stableRelease, tag_name: 'dev-v2.6.0-1-gabcdef' },
    { ...stableRelease, tag_name: 'latest' },
    undefined,
  ])('does not advertise draft, preview, or unavailable releases', (release) => {
    expect(getReleaseUpdate('v2.5.0', release)).toBeNull();
  });
});
