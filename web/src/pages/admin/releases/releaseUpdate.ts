export const LATEST_RELEASE_API = 'https://api.github.com/repos/rabithua/rote/releases/latest';

export interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
}

export interface ReleaseUpdate {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export function isStableVersion(version: string | undefined): version is string {
  return typeof version === 'string' && /^v\d+\.\d+\.\d+$/.test(version);
}

export function getReleaseUpdate(
  currentVersion: string | undefined,
  release: GithubRelease | undefined
): ReleaseUpdate | null {
  if (
    !isStableVersion(currentVersion) ||
    !release ||
    release.draft !== false ||
    release.prerelease !== false ||
    !isStableVersion(release.tag_name)
  ) {
    return null;
  }

  const currentParts = currentVersion.slice(1).split('.').map(Number);
  const latestParts = release.tag_name.slice(1).split('.').map(Number);

  for (let index = 0; index < currentParts.length; index += 1) {
    if (latestParts[index] < currentParts[index]) return null;
    if (latestParts[index] > currentParts[index]) {
      return {
        currentVersion,
        latestVersion: release.tag_name,
        releaseUrl: `https://github.com/Rabithua/Rote/releases/tag/${encodeURIComponent(release.tag_name)}`,
      };
    }
  }

  return null;
}
