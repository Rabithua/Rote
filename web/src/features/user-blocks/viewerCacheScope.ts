import { authService } from '@/utils/auth';

export function getViewerCacheScope(accountId?: string): string {
  const token = authService.getAccessToken();
  const tokenAccountId = token ? authService.getUserInfoFromToken(token)?.userId : undefined;
  const origin = typeof window === 'undefined' ? 'server' : window.location.origin;
  return `${origin}|${accountId || tokenAccountId || 'anonymous'}`;
}

export function viewerAwareCacheKey(key: string, accountId?: string) {
  return ['viewer-aware', getViewerCacheScope(accountId), key] as const;
}
