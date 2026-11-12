import { validateRedirectUrl } from './redirects';

export interface OAuthCompletionContext {
  frontendBaseUrl: string;
  redirectUrl: string;
  iosLogin: boolean;
}

function getWebRedirect(context: OAuthCompletionContext): URL {
  const base = new URL(context.frontendBaseUrl);
  const destination = new URL(validateRedirectUrl(context.redirectUrl, '/login'), base);
  return destination.origin === base.origin ? destination : new URL('/login', base);
}

export function getOAuthRegistrationUrl(
  context: OAuthCompletionContext,
  registrationToken: string
): string {
  const destination = getWebRedirect(context);
  const loginUrl = new URL('/login', context.frontendBaseUrl);
  const redirect =
    destination.pathname === '/login'
      ? destination.searchParams.get('redirect')
      : `${destination.pathname}${destination.search}${destination.hash}`;
  if (redirect) loginUrl.searchParams.set('redirect', redirect);
  if (context.iosLogin) loginUrl.searchParams.set('type', 'ioslogin');
  loginUrl.searchParams.set('oauth', 'register');
  loginUrl.searchParams.set('registrationToken', registrationToken);
  return loginUrl.toString();
}

export function getOAuthCompletionUrl(
  context: OAuthCompletionContext,
  provider: string,
  tokens: { accessToken: string; refreshToken: string }
): string {
  if (context.iosLogin) {
    const callback = new URL('rote://callback');
    callback.searchParams.set('token', tokens.accessToken);
    callback.searchParams.set('refreshToken', tokens.refreshToken);
    return callback.toString();
  }

  const destination = getWebRedirect(context);
  destination.searchParams.set('oauth', 'success');
  destination.searchParams.set('provider', provider);
  destination.searchParams.set('token', tokens.accessToken);
  destination.searchParams.set('refreshToken', tokens.refreshToken);
  return destination.toString();
}

export function getOAuthDeleteConfirmUrl(
  context: OAuthCompletionContext,
  deleteGrant: string,
  provider: string
): string {
  const destination = getWebRedirect(context);
  destination.searchParams.set('oauth', 'delete-confirmed');
  destination.searchParams.set('deleteGrant', deleteGrant);
  destination.searchParams.set('provider', provider);
  return destination.toString();
}
