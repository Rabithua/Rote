const DEFAULT_LOGIN_REDIRECT = '/home';

export function isSafeLoginRedirect(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function getSafeLoginRedirect(
  search: string | URLSearchParams,
  fallback = DEFAULT_LOGIN_REDIRECT
) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const redirectTarget = params.get('redirect');
  return isSafeLoginRedirect(redirectTarget) ? redirectTarget : fallback;
}

export function getCurrentRedirectPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function getLoginPathWithRedirect(redirectPath: string = getCurrentRedirectPath()) {
  return isSafeLoginRedirect(redirectPath)
    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
    : '/login';
}
