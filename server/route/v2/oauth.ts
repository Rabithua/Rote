import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { users } from '../../drizzle/schema';
import type { SecurityConfig, SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig } from '../../utils/config';
import { createUser, findUserByOAuthId, generateUniqueUsername } from '../../utils/dbMethods/user';
import db from '../../utils/drizzle';
import { exchangeCodeForToken, getGitHubUserInfo } from '../../utils/githubOAuth';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { createResponse } from '../../utils/main';
import { extractStateData, generateStateToken } from '../../utils/oauth';

const oauthRouter = new Hono<{ Variables: HonoVariables }>();

// 验证 OAuth 配置并返回已验证的 GitHub 配置
async function validateOAuthConfig(): Promise<{
  oauthConfig: NonNullable<SecurityConfig['oauth']>;
  githubConfig: NonNullable<NonNullable<SecurityConfig['oauth']>['providers']['github']>;
}> {
  const securityConfig = await getConfig<SecurityConfig>('security');
  if (!securityConfig?.oauth) {
    throw new Error('OAuth is not configured');
  }

  const oauthConfig = securityConfig.oauth;
  if (!oauthConfig.enabled) {
    throw new Error('OAuth is disabled');
  }

  const githubConfig = oauthConfig.providers?.github;
  if (!githubConfig?.enabled) {
    throw new Error('GitHub OAuth is disabled');
  }

  if (!githubConfig.clientId || !githubConfig.clientSecret) {
    throw new Error('GitHub OAuth clientId or clientSecret is missing');
  }

  if (!githubConfig.callbackUrl) {
    throw new Error('GitHub OAuth callbackUrl is missing');
  }

  // 返回已验证的配置
  return {
    oauthConfig,
    githubConfig: githubConfig as NonNullable<typeof githubConfig>,
  };
}

// 发起 GitHub OAuth 授权
oauthRouter.get('/github', async (c: HonoContext) => {
  try {
    const { githubConfig } = await validateOAuthConfig();

    // 获取查询参数
    const iosLogin = c.req.query('type') === 'ioslogin';
    let redirectUrl = c.req.query('redirect') || '/login';

    // 验证 redirectUrl 防止开放重定向攻击
    // 只允许相对路径（以 / 开头）或空字符串
    if (redirectUrl && !redirectUrl.startsWith('/')) {
      redirectUrl = '/login'; // 如果不符合要求，使用默认值
    }

    // 生成 state token
    const state = await generateStateToken({
      redirectUrl,
      iosLogin,
    });

    // 构建 GitHub 授权 URL
    const scopes = githubConfig.scopes || ['user:email'];
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', githubConfig.clientId);
    githubAuthUrl.searchParams.set('redirect_uri', githubConfig.callbackUrl);
    githubAuthUrl.searchParams.set('scope', scopes.join(' '));
    githubAuthUrl.searchParams.set('state', state);

    // 重定向到 GitHub
    return c.redirect(githubAuthUrl.toString());
  } catch (error: any) {
    console.error('GitHub OAuth initiation error:', error);
    return c.json(
      createResponse(null, error.message || 'Failed to initiate GitHub OAuth', 500),
      500
    );
  }
});

// GitHub OAuth 回调处理
oauthRouter.get('/github/callback', async (c: HonoContext) => {
  try {
    const { githubConfig } = await validateOAuthConfig();

    // 获取回调参数
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    // 处理用户取消授权
    if (error === 'access_denied') {
      const siteConfig = await getConfig<SiteConfig>('site');
      const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
      const frontendBaseUrl =
        dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
      const loginUrl = new URL('/login', frontendBaseUrl);
      loginUrl.searchParams.set('oauth', 'cancelled');
      return c.redirect(loginUrl.toString());
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

    // 交换授权码获取 access_token
    const accessToken = await exchangeCodeForToken(code, githubConfig);

    // 获取 GitHub 用户信息
    const githubUser = await getGitHubUserInfo(accessToken);

    // 查找是否已存在该 GitHub 用户
    let user = await findUserByOAuthId('github', githubUser.id);

    if (!user) {
      // 检查邮箱是否已被其他账户使用
      if (githubUser.email) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, githubUser.email))
          .limit(1);

        if (existingUser && existingUser.authProvider !== 'github') {
          throw new Error('该邮箱已被其他账户使用，请使用用户名密码登录后关联 GitHub 账户');
        }
      }

      // 生成唯一用户名（如果 GitHub 用户名为空或清理后为空，使用 'github' 作为前缀）
      const baseUsername = githubUser.username || `github-${githubUser.id}`;
      const username = await generateUniqueUsername(baseUsername, 'github');

      // 如果没有邮箱，生成临时邮箱
      // 确保 githubUser.id 存在且有效
      if (!githubUser.id) {
        throw new Error('GitHub user ID is missing');
      }
      const email = githubUser.email || `github-${githubUser.id}@temp.rote.local`;

      // 创建新用户
      try {
        user = await createUser({
          username,
          email,
          nickname: githubUser.name || githubUser.username,
          authProvider: 'github',
          authProviderId: githubUser.id,
          avatar: githubUser.avatar ?? undefined,
        });
      } catch (createError: any) {
        // 处理唯一约束冲突（并发情况）
        if (createError.code === '23505') {
          // 重新查找用户
          user = await findUserByOAuthId('github', githubUser.id);
          if (!user) {
            throw new Error('Failed to create user due to conflict');
          }
        } else {
          throw createError;
        }
      }
    }

    // 生成 JWT tokens
    const jwtAccessToken = await generateAccessToken({
      userId: user.id,
      username: user.username,
    });
    const jwtRefreshToken = await generateRefreshToken({
      userId: user.id,
      username: user.username,
    });

    // 根据 state 中的信息决定重定向方式
    const iosLogin = stateData.iosLogin === true;
    const redirectUrl = stateData.redirectUrl || '/login'; // 从 state 中获取，已验证安全

    if (iosLogin) {
      // iOS web 登录流程：重定向到自定义 scheme
      const callbackUrl = `rote://callback?token=${jwtAccessToken}&refreshToken=${jwtRefreshToken}`;
      return c.redirect(callbackUrl);
    } else {
      // 普通 web 登录流程：重定向到登录页面，通过 URL 参数传递 tokens
      const siteConfig = await getConfig<SiteConfig>('site');
      const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
      const frontendBaseUrl =
        dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
      // 使用 state 中已验证的 redirectUrl
      const loginUrl = new URL(redirectUrl, frontendBaseUrl);
      loginUrl.searchParams.set('oauth', 'success');
      loginUrl.searchParams.set('token', jwtAccessToken);
      loginUrl.searchParams.set('refreshToken', jwtRefreshToken);
      return c.redirect(loginUrl.toString());
    }
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);

    // 区分用户友好错误和系统错误，避免泄露敏感信息
    let userFriendlyMessage = 'GitHub OAuth authentication failed';
    if (error.message) {
      // 只返回用户友好的错误消息
      const safeMessages = [
        '该邮箱已被其他账户使用',
        'Invalid or expired state token',
        'Missing code or state parameter',
        'OAuth error: access_denied',
      ];
      if (safeMessages.some((msg) => error.message.includes(msg))) {
        userFriendlyMessage = error.message;
      }
    }

    try {
      const siteConfig = await getConfig<SiteConfig>('site');
      const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
      const frontendBaseUrl =
        dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
      const loginUrl = new URL('/login', frontendBaseUrl);
      loginUrl.searchParams.set('oauth', 'error');
      loginUrl.searchParams.set('message', userFriendlyMessage);
      return c.redirect(loginUrl.toString());
    } catch (_redirectError) {
      // 如果重定向失败，返回 JSON 错误
      return c.json(createResponse(null, `OAuth error: ${userFriendlyMessage}`, 500), 500);
    }
  }
});

export default oauthRouter;
