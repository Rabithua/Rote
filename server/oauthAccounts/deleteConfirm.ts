import { SignJWT, jwtVerify } from 'jose';
import type { SecurityConfig } from '../types/config';
import { getGlobalConfig } from '../utils/config';
import { getUserOAuthBindings } from '../utils/dbMethods/userOAuth';
import type { OAuthUserInfo } from '../utils/oauth/providers/base';
import type { HonoContext } from '../types/hono';
import { getFrontendBaseUrl, validateRedirectUrl } from './redirects';

// 删除确认授予令牌：provider 再授权或 Passkey 断言通过后签发，
// 删除接口校验其 purpose 与归属，有效期 5 分钟。
export async function generateDeleteGrantToken(userid: string): Promise<string> {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config?.sessionSecret) {
    throw new Error('Session secret is not configured');
  }
  return await new SignJWT({ purpose: 'account_delete', userId: userid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-app')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(config.sessionSecret));
}

export async function verifyDeleteGrantToken(token: unknown, userid: string): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config?.sessionSecret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.sessionSecret), {
      issuer: 'rote-app',
    });
    return payload.purpose === 'account_delete' && payload.userId === userid;
  } catch {
    return false;
  }
}

// 删除确认模式的 OAuth 回调：再次验证的 provider 身份必须已绑定到发起用户，
// 通过后签发删除授予令牌并带回前端。
export async function completeOAuthDeleteConfirm(
  c: HonoContext,
  providerName: string,
  oauthUser: OAuthUserInfo,
  stateData: Record<string, unknown>
): Promise<Response> {
  const targetUserId = stateData.userId as string;
  const bindings = await getUserOAuthBindings(targetUserId);
  const belongsToUser = bindings.some(
    (binding) => binding.provider === providerName && binding.providerId === oauthUser.id
  );
  if (!belongsToUser) {
    throw new Error('The re-authenticated identity is not bound to this account');
  }

  const deleteGrant = await generateDeleteGrantToken(targetUserId);

  const frontendBaseUrl = await getFrontendBaseUrl(c);
  const destination = new URL(
    validateRedirectUrl(stateData.redirectUrl as string, '/profile/setting'),
    frontendBaseUrl
  );
  destination.searchParams.set('oauth', 'delete-confirmed');
  destination.searchParams.set('deleteGrant', deleteGrant);
  destination.searchParams.set('provider', providerName);
  return c.redirect(destination.toString());
}
