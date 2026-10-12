import { useSiteStatus } from '@/hooks/useSiteStatus';
import useSWR from 'swr';
import {
  getReleaseUpdate,
  isStableVersion,
  LATEST_RELEASE_API,
  type GithubRelease,
} from './releaseUpdate';

export default function useReleaseUpdate() {
  const { data: siteStatus } = useSiteStatus();
  const currentVersion = siteStatus?.system.releaseVersion;
  const { data: release } = useSWR<GithubRelease>(
    isStableVersion(currentVersion) ? LATEST_RELEASE_API : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) {
        throw new Error(`Release lookup failed: HTTP ${response.status}`);
      }
      return response.json();
    },
    {
      dedupingInterval: 30 * 60 * 1000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return getReleaseUpdate(currentVersion, release);
}
