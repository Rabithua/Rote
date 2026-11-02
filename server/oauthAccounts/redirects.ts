import type { HonoContext } from '../types/hono';
import type { SiteConfig } from '../types/config';
import { getConfig } from '../utils/config';
import { createResponse } from '../utils/main';
import { extractStateData } from '../utils/oauth';
import { oauthProviderRegistry } from '../utils/oauth/providers';
import messages from './messages.json';

// 验证 redirectUrl 防止开放重定向攻击
export function validateRedirectUrl(
  redirectUrl: string | null | undefined,
  defaultUrl: string
): string {
  if (!redirectUrl) {
    return defaultUrl;
  }

  // 只允许相对路径（以 / 开头）或空字符串
  // 禁止协议相对 URL（//evil.com）和包含外部域名的 URL
  if (
    redirectUrl &&
    (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//') || redirectUrl.includes('://'))
  ) {
    return defaultUrl;
  }

  return redirectUrl;
}

function getLoginRedirectUrl(frontendBaseUrl: string, stateData: any | null): URL {
  return new URL(validateRedirectUrl(stateData?.redirectUrl, '/login'), frontendBaseUrl);
}

export async function extractOptionalStateData(state: string | undefined): Promise<any | null> {
  if (!state) return null;

  try {
    return await extractStateData(state);
  } catch {
    // Provider cancel callbacks may omit or expire state; route back to the default login page.
    return null;
  }
}

// 获取前端基础 URL
export async function getFrontendBaseUrl(c: HonoContext): Promise<string> {
  const siteConfig = await getConfig<SiteConfig>('site');
  const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
  return dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
}

// 处理 OAuth 错误重定向
export async function handleOAuthError(
  c: HonoContext,
  error: any,
  provider: string,
  stateData: any | null
): Promise<Response> {
  const providerInstance = oauthProviderRegistry.getProvider(provider);
  const errorMessages = providerInstance?.getErrorMessages() || [];

  // 区分用户友好错误和系统错误，避免泄露敏感信息
  let userFriendlyMessage = messages.authenticationFailed.replace(/\{provider\}/, provider);
  if (error.message) {
    if (errorMessages.some((msg) => error.message.includes(msg))) {
      userFriendlyMessage = error.message;
    }
  }

  try {
    const frontendBaseUrl = await getFrontendBaseUrl(c);
    const isBindMode = stateData?.bindMode === true;

    if (isBindMode) {
      // 绑定模式错误，重定向到 profile 页面
      const redirectUrl = stateData?.redirectUrl || '/profile';
      const bindUrl = new URL(redirectUrl, frontendBaseUrl);
      bindUrl.searchParams.set('oauth', 'bind');
      bindUrl.searchParams.set('bind', 'error');
      bindUrl.searchParams.set('provider', provider);
      bindUrl.searchParams.set('message', userFriendlyMessage);
      return c.redirect(bindUrl.toString());
    } else {
      // 登录模式错误，重定向到登录页面
      const loginUrl = getLoginRedirectUrl(frontendBaseUrl, stateData);
      loginUrl.searchParams.set('oauth', 'error');
      loginUrl.searchParams.set('provider', provider);
      loginUrl.searchParams.set('message', userFriendlyMessage);
      return c.redirect(loginUrl.toString());
    }
  } catch (_redirectError) {
    // 如果重定向失败，返回 JSON 错误
    return c.json(
      createResponse(null, messages.errorResponse.replace(/\{message\}/, userFriendlyMessage), 500),
      500
    );
  }
}

// 处理用户取消授权
export async function handleOAuthCancelled(
  c: HonoContext,
  provider: string,
  _errorCode: string,
  stateData: any | null
): Promise<Response> {
  const frontendBaseUrl = await getFrontendBaseUrl(c);
  const loginUrl = getLoginRedirectUrl(frontendBaseUrl, stateData);
  loginUrl.searchParams.set('oauth', 'cancelled');
  loginUrl.searchParams.set('provider', provider);
  return c.redirect(loginUrl.toString());
}
