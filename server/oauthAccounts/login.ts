import type { HonoContext } from '../types/hono';
import { findUserByOAuthBinding } from '../utils/dbMethods/userOAuth';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import type { OAuthStatePayload } from '../utils/oauth';
import type { OAuthUserInfo } from '../utils/oauth/providers/base';
import { getOAuthCompletionUrl, getOAuthRegistrationUrl } from './completion';
import { beginOAuthRegistration } from './registration';
import { getFrontendBaseUrl, validateRedirectUrl } from './redirects';

export async function completeOAuthLogin(
  c: HonoContext,
  providerName: string,
  oauthUser: OAuthUserInfo,
  stateData: OAuthStatePayload,
  _additionalParams: unknown
): Promise<Response> {
  c.header('Cache-Control', 'no-store');
  const user = await findUserByOAuthBinding(providerName, oauthUser.id);
  const context = {
    frontendBaseUrl: await getFrontendBaseUrl(c),
    redirectUrl: validateRedirectUrl(stateData.redirectUrl, '/login'),
    iosLogin: stateData.iosLogin === true,
  };

  if (!user) {
    const registrationToken = await beginOAuthRegistration(providerName, oauthUser, context);
    return c.redirect(getOAuthRegistrationUrl(context, registrationToken));
  }

  const payload = { userId: user.id, username: user.username };
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);
  return c.redirect(getOAuthCompletionUrl(context, providerName, { accessToken, refreshToken }));
}
