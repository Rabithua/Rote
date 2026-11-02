import { Hono } from 'hono';
import { completeOAuthAccountMerge } from '../../accountMerge/authorization';
import { AccountMergeError } from '../../accountMerge/errors';
import mergeMessages from '../../accountMerge/messages.json';
import { parseOAuthMergeRequest } from '../../accountMerge/request';
import type { User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { SecurityConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig } from '../../utils/config';
import { getUserOAuthBindings, unbindOAuthProvider } from '../../utils/dbMethods';
import { oneUser } from '../../utils/dbMethods/user';
import { createResponse } from '../../utils/main';
import { extractStateData, generateStateToken } from '../../utils/oauth';
// 导入提供商注册器（这会自动注册所有提供商）
import '../../utils/oauth/providers';
import { completeOAuthBinding } from '../../oauthAccounts/binding';
import { completeOAuthLogin } from '../../oauthAccounts/login';
import { OAuthUnbindWouldPreventLogin } from '../../oauthAccounts/errors';
import oauthMessages from '../../oauthAccounts/messages.json';
import {
  validateRedirectUrl,
  extractOptionalStateData,
  handleOAuthCancelled,
  handleOAuthError,
} from '../../oauthAccounts/redirects';
import { oauthProviderRegistry } from '../../utils/oauth/providers';

const oauthRouter = new Hono<{ Variables: HonoVariables }>();

// 发起 OAuth 授权
oauthRouter.get('/:provider', async (c: HonoContext) => {
  try {
    const providerName = c.req.param('provider');
    const provider = oauthProviderRegistry.getProvider(providerName);

    if (!provider) {
      return c.json(
        createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
        404
      );
    }

    // 验证配置
    const securityConfig = await getConfig<SecurityConfig>('security');
    if (!securityConfig?.oauth?.enabled) {
      throw new Error('OAuth is disabled');
    }

    const providerConfig = securityConfig.oauth.providers?.[providerName];
    if (!providerConfig) {
      throw new Error(`OAuth provider "${providerName}" is not configured`);
    }

    await provider.validateConfig(providerConfig);

    // 获取查询参数
    const iosLogin = c.req.query('type') === 'ioslogin';
    const redirectUrl = validateRedirectUrl(c.req.query('redirect'), '/login');

    // 生成 state token（包含 provider 信息）
    const state = await generateStateToken({
      provider: providerName,
      redirectUrl,
      iosLogin,
    });

    // 生成授权 URL
    const authUrl = provider.getAuthUrl(providerConfig, state, redirectUrl);

    // 重定向到 OAuth 提供商
    return c.redirect(authUrl);
  } catch (error: any) {
    console.error(`OAuth initiation error for ${c.req.param('provider')}:`, error);
    return c.json(createResponse(null, error.message || 'Failed to initiate OAuth', 500), 500);
  }
});

// 绑定 OAuth 账户（需要登录）
oauthRouter.get('/:provider/bind', authenticateJWT, async (c: HonoContext) => {
  try {
    const providerName = c.req.param('provider');
    const provider = oauthProviderRegistry.getProvider(providerName);

    if (!provider) {
      return c.json(
        createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
        404
      );
    }

    const user = c.get('user') as User;

    // 检查用户是否已绑定
    const fullUser = await oneUser(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }

    // 检查用户是否已经绑定了该 OAuth 提供商
    const existingBindings = await getUserOAuthBindings(user.id);
    const hasBinding = existingBindings.some((binding) => binding.provider === providerName);
    if (hasBinding) {
      return c.json(
        createResponse(null, `您已绑定 ${providerName} 账户，请先解绑后再绑定新的账户`, 400),
        400
      );
    }

    // 验证配置
    const securityConfig = await getConfig<SecurityConfig>('security');
    if (!securityConfig?.oauth?.enabled) {
      throw new Error('OAuth is disabled');
    }

    const providerConfig = securityConfig.oauth.providers?.[providerName];
    if (!providerConfig) {
      throw new Error(`OAuth provider "${providerName}" is not configured`);
    }

    await provider.validateConfig(providerConfig);

    // 获取查询参数
    const redirectUrl = validateRedirectUrl(c.req.query('redirect'), '/profile');

    // 生成包含绑定模式的 state token（包含 provider 信息）
    const state = await generateStateToken({
      provider: providerName,
      redirectUrl,
      bindMode: true,
      userId: user.id,
    });

    // 生成授权 URL
    const authUrl = provider.getAuthUrl(providerConfig, state, redirectUrl);

    // 返回 JSON 响应，包含重定向 URL（前端需要手动跳转以携带 Authorization header）
    return c.json(
      createResponse(
        {
          redirectUrl: authUrl,
        },
        `Redirect to ${providerName} for authorization`
      ),
      200
    );
  } catch (error: any) {
    console.error(`OAuth bind initiation error for ${c.req.param('provider')}:`, error);
    return c.json(createResponse(null, error.message || 'Failed to initiate OAuth bind', 500), 500);
  }
});

// OAuth 回调处理（支持 GET 和 POST）
async function handleOAuthCallback(c: HonoContext, providerName: string): Promise<Response> {
  try {
    const provider = oauthProviderRegistry.getProvider(providerName);

    if (!provider) {
      return c.json(
        createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
        404
      );
    }

    // 验证配置
    const securityConfig = await getConfig<SecurityConfig>('security');
    if (!securityConfig?.oauth?.enabled) {
      throw new Error('OAuth is disabled');
    }

    const providerConfig = securityConfig.oauth.providers?.[providerName];
    if (!providerConfig) {
      throw new Error(`OAuth provider "${providerName}" is not configured`);
    }

    await provider.validateConfig(providerConfig);

    // 根据提供商的 callbackMethod 获取参数
    let code: string | undefined;
    let state: string | undefined;
    let error: string | undefined;
    const additionalParams: any = {};

    if (provider.callbackMethod === 'POST') {
      // Apple 使用 POST，从 body 获取
      const body = await c.req.parseBody();
      code = body.code as string | undefined;
      state = body.state as string | undefined;
      error = body.error as string | undefined;
      additionalParams.userParam = body.user as string | undefined;
    } else {
      // GitHub 使用 GET，从 query 获取
      code = c.req.query('code');
      state = c.req.query('state');
      error = c.req.query('error');
    }

    // 处理用户取消授权
    const cancelErrors = ['access_denied', 'user_cancelled_authorize'];
    if (error && cancelErrors.includes(error)) {
      return await handleOAuthCancelled(
        c,
        providerName,
        error,
        await extractOptionalStateData(state)
      );
    }

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // 验证 state token
    const stateData = await extractStateData(state);
    if (!stateData) {
      throw new Error('Invalid or expired state token');
    }

    // 验证 state 中的 provider 是否匹配
    if (stateData.provider !== providerName) {
      throw new Error('Provider mismatch in state token');
    }

    // 交换授权码获取 token
    const tokenData = await provider.exchangeCode(code, providerConfig, additionalParams);

    // 获取用户信息
    const oauthUser = await provider.getUserInfo(tokenData, providerConfig, additionalParams);

    // 检查是否是绑定模式
    const isBindMode = stateData.bindMode === true && stateData.userId;

    if (isBindMode) {
      return await completeOAuthBinding(c, providerName, oauthUser, stateData);
    }

    return await completeOAuthLogin(c, providerName, oauthUser, stateData, additionalParams);
  } catch (error: any) {
    console.error(`OAuth callback error for ${providerName}:`, error);

    // 尝试从 state 中获取信息（根据提供商的 callbackMethod）
    let stateData: any | null = null;
    try {
      const provider = oauthProviderRegistry.getProvider(providerName);
      if (provider?.callbackMethod === 'POST') {
        const body = await c.req.parseBody();
        const state = body.state as string | undefined;
        if (state) {
          stateData = await extractStateData(state);
        }
      } else {
        const state = c.req.query('state');
        if (state) {
          stateData = await extractStateData(state);
        }
      }
    } catch {
      // 忽略 state 解析错误
    }

    return await handleOAuthError(c, error, providerName, stateData);
  }
}

// GET 回调（GitHub）
oauthRouter.get('/:provider/callback', async (c: HonoContext) => {
  const providerName = c.req.param('provider');
  const provider = oauthProviderRegistry.getProvider(providerName);

  if (!provider) {
    return c.json(
      createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
      404
    );
  }

  if (provider.callbackMethod !== 'GET') {
    return c.json(
      createResponse(null, `OAuth provider "${providerName}" requires POST callback`, 405),
      405
    );
  }

  return await handleOAuthCallback(c, providerName);
});

// POST 回调（Apple）
oauthRouter.post('/:provider/callback', async (c: HonoContext) => {
  const providerName = c.req.param('provider');
  const provider = oauthProviderRegistry.getProvider(providerName);

  if (!provider) {
    return c.json(
      createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
      404
    );
  }

  if (provider.callbackMethod !== 'POST') {
    return c.json(
      createResponse(null, `OAuth provider "${providerName}" requires GET callback`, 405),
      405
    );
  }

  return await handleOAuthCallback(c, providerName);
});

// Confirmation retains the legacy API shape; provider ownership is established
// by the successful OAuth callback and stored in a short-lived server-side grant.
oauthRouter.post('/:provider/bind/merge', authenticateJWT, async (c: HonoContext) => {
  try {
    const providerName = c.req.param('provider');
    if (!oauthProviderRegistry.getProvider(providerName)) {
      return c.json(createResponse(null, mergeMessages.oauth_merge_invalid_request, 404), 404);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new AccountMergeError('oauth_merge_invalid_request');
    }
    const request = parseOAuthMergeRequest(body, providerName);
    if (!request) throw new AccountMergeError('oauth_merge_invalid_request');
    const result = await completeOAuthAccountMerge({
      ...request,
      targetUserId: c.get('user')!.id,
      provider: providerName,
    });
    return c.json(
      createResponse(
        { merged: true, mergedData: result.mergedData },
        mergeMessages.oauth_merge_success
      ),
      200
    );
  } catch (error) {
    const failure =
      error instanceof AccountMergeError ? error : new AccountMergeError('oauth_merge_failed');
    if (!(error instanceof AccountMergeError)) process.stderr.write('oauth_account_merge_failed\n');
    return c.json(
      { ...createResponse(null, failure.message, failure.status), errorCode: failure.code },
      failure.status
    );
  }
});

// 解绑 OAuth 账户
oauthRouter.delete('/:provider/bind', authenticateJWT, async (c: HonoContext) => {
  try {
    const providerName = c.req.param('provider');
    const provider = oauthProviderRegistry.getProvider(providerName);

    if (!provider) {
      return c.json(
        createResponse(null, `OAuth provider "${providerName}" is not supported`, 404),
        404
      );
    }

    const user = c.get('user') as User;
    const fullUser = await oneUser(user.id);

    if (!fullUser) {
      throw new Error('User not found');
    }

    // 检查用户是否已绑定该 OAuth 提供商
    const existingBindings = await getUserOAuthBindings(user.id);
    const hasBinding = existingBindings.some((binding) => binding.provider === providerName);
    if (!hasBinding) {
      return c.json(createResponse(null, `您尚未绑定 ${providerName} 账户`, 400), 400);
    }

    // 检查解绑后是否还有其他登录方式
    const otherBindings = existingBindings.filter((binding) => binding.provider !== providerName);
    const hasPassword = fullUser.passwordhash && fullUser.salt;
    const hasOtherBindings = otherBindings.length > 0;

    // 如果没有密码且没有其他绑定，解绑后将无法登录
    if (!hasPassword && !hasOtherBindings) {
      return c.json(createResponse(null, oauthMessages.unbindWouldPreventLogin, 400), 400);
    }

    // 解绑 OAuth 提供商
    await unbindOAuthProvider(user.id, providerName);

    return c.json(createResponse(null, `${providerName} 账户已解绑`), 200);
  } catch (error: any) {
    if (error instanceof OAuthUnbindWouldPreventLogin) {
      return c.json(createResponse(null, error.message, 400), 400);
    }
    console.error(`Unbind error for ${c.req.param('provider')}:`, error);
    return c.json(
      createResponse(
        null,
        error.message || `Failed to unbind ${c.req.param('provider')} account`,
        500
      ),
      500
    );
  }
});

export default oauthRouter;
