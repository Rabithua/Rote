import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { SecurityConfig, SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig } from '../../utils/config';
import {
  createUser,
  findUserByOAuthId,
  generateUniqueUsername,
  mergeUserAccounts,
  oneUser,
} from '../../utils/dbMethods/user';
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
    // 禁止协议相对 URL（//evil.com）和包含外部域名的 URL
    if (
      redirectUrl &&
      (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//') || redirectUrl.includes('://'))
    ) {
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

// 绑定 GitHub 账户（需要登录）
oauthRouter.get('/github/bind', authenticateJWT, async (c: HonoContext) => {
  try {
    const { githubConfig } = await validateOAuthConfig();
    const user = c.get('user') as User;

    // 检查用户是否已绑定 GitHub
    const fullUser = await oneUser(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }

    // 如果用户已经绑定了 GitHub（authProviderId 不为空），不允许重复绑定
    if (fullUser.authProviderId) {
      return c.json(
        createResponse(null, '您已绑定 GitHub 账户，请先解绑后再绑定新的账户', 400),
        400
      );
    }

    // 获取查询参数
    let redirectUrl = c.req.query('redirect') || '/profile';

    // 验证 redirectUrl 防止开放重定向攻击
    // 只允许相对路径（以 / 开头）或空字符串
    // 禁止协议相对 URL（//evil.com）和包含外部域名的 URL
    if (
      redirectUrl &&
      (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//') || redirectUrl.includes('://'))
    ) {
      redirectUrl = '/profile';
    }

    // 生成包含绑定模式的 state token
    const state = await generateStateToken({
      redirectUrl,
      bindMode: true,
      userId: user.id,
    });

    // 构建 GitHub 授权 URL
    const scopes = githubConfig.scopes || ['user:email'];
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', githubConfig.clientId);
    githubAuthUrl.searchParams.set('redirect_uri', githubConfig.callbackUrl);
    githubAuthUrl.searchParams.set('scope', scopes.join(' '));
    githubAuthUrl.searchParams.set('state', state);

    // 返回 JSON 响应，包含重定向 URL（前端需要手动跳转以携带 Authorization header）
    return c.json(
      createResponse(
        {
          redirectUrl: githubAuthUrl.toString(),
        },
        'Redirect to GitHub for authorization'
      ),
      200
    );
  } catch (error: any) {
    console.error('GitHub OAuth bind initiation error:', error);
    return c.json(
      createResponse(null, error.message || 'Failed to initiate GitHub OAuth bind', 500),
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

    // 检查是否是绑定模式
    const isBindMode = stateData.bindMode === true && stateData.userId;

    if (isBindMode) {
      // 绑定模式：将 GitHub 账户绑定到现有用户
      const targetUserId = stateData.userId as string;
      const targetUser = await oneUser(targetUserId);

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      // 检查目标用户是否已经绑定了 GitHub（防止在授权过程中状态改变）
      if (targetUser.authProviderId) {
        if (targetUser.authProviderId === githubUser.id) {
          throw new Error('您已绑定此 GitHub 账户');
        }
        throw new Error('您的账户已绑定其他 GitHub 账户，请先解绑');
      }

      // 检查 GitHub ID 是否已被使用
      const existingGitHubUser = await findUserByOAuthId('github', githubUser.id);

      if (existingGitHubUser) {
        // 如果这个 GitHub ID 已经被其他用户使用，返回需要合并的信息
        if (existingGitHubUser.id !== targetUserId) {
          // 返回需要合并的信息，让前端显示确认对话框
          const siteConfig = await getConfig<SiteConfig>('site');
          const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
          const frontendBaseUrl =
            dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
          const redirectUrl = stateData.redirectUrl || '/profile';
          const bindUrl = new URL(redirectUrl, frontendBaseUrl);
          bindUrl.searchParams.set('oauth', 'bind');
          bindUrl.searchParams.set('bind', 'merge_required');
          bindUrl.searchParams.set('existingUserId', existingGitHubUser.id);
          bindUrl.searchParams.set('existingUsername', existingGitHubUser.username || '');
          bindUrl.searchParams.set('existingEmail', existingGitHubUser.email || '');
          bindUrl.searchParams.set('githubUserId', githubUser.id);
          bindUrl.searchParams.set('githubUsername', githubUser.username);
          return c.redirect(bindUrl.toString());
        }
      }

      // 更新用户信息：绑定 GitHub
      // 如果用户是 local，保持 authProvider 为 local，设置 authProviderId
      // 如果用户是纯 OAuth 用户（无密码），更新 authProvider 为 github
      const updateData: any = {
        authProviderId: githubUser.id,
        authProviderUsername: githubUser.username,
        updatedAt: new Date(),
      };

      // 如果用户没有密码，更新 authProvider 为 github
      if (!targetUser.passwordhash || !targetUser.salt) {
        updateData.authProvider = 'github';
      }
      // 如果用户有密码，保持 authProvider 为 local（不更新）

      // 更新头像（如果 GitHub 有头像且用户没有）
      if (githubUser.avatar && !targetUser.avatar) {
        updateData.avatar = githubUser.avatar;
      }

      await db.update(users).set(updateData).where(eq(users.id, targetUserId));

      // 绑定成功，重定向回前端
      const siteConfig = await getConfig<SiteConfig>('site');
      const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
      const frontendBaseUrl =
        dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
      const redirectUrl = stateData.redirectUrl || '/profile';
      const bindUrl = new URL(redirectUrl, frontendBaseUrl);
      bindUrl.searchParams.set('oauth', 'bind');
      bindUrl.searchParams.set('bind', 'success');
      return c.redirect(bindUrl.toString());
    }

    // 登录模式：创建新用户或登录已有用户
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
          authProviderUsername: githubUser.username,
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
        '该 GitHub 账户已被其他用户使用',
        '该 GitHub 账户已被其他用户使用，无法绑定到此账户',
        '该 GitHub 账户已被其他用户使用。如果这是您的账户，请使用该账户登录后绑定，或联系管理员合并账户',
        '账户合并失败',
        '您已绑定此 GitHub 账户',
        '您的账户已绑定其他 GitHub 账户，请先解绑',
        'Invalid or expired state token',
        'Missing code or state parameter',
        'OAuth error: access_denied',
        'Target user not found',
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

      // 检查是否是绑定模式的错误
      const stateData = c.req.query('state')
        ? await extractStateData(c.req.query('state') || '')
        : null;
      const isBindMode = stateData?.bindMode === true;

      if (isBindMode) {
        // 绑定模式错误，重定向到 profile 页面
        const redirectUrl = stateData?.redirectUrl || '/profile';
        const bindUrl = new URL(redirectUrl, frontendBaseUrl);
        bindUrl.searchParams.set('oauth', 'bind');
        bindUrl.searchParams.set('bind', 'error');
        bindUrl.searchParams.set('message', userFriendlyMessage);
        return c.redirect(bindUrl.toString());
      } else {
        // 登录模式错误，重定向到登录页面
        const loginUrl = new URL('/login', frontendBaseUrl);
        loginUrl.searchParams.set('oauth', 'error');
        loginUrl.searchParams.set('message', userFriendlyMessage);
        return c.redirect(loginUrl.toString());
      }
    } catch (_redirectError) {
      // 如果重定向失败，返回 JSON 错误
      return c.json(createResponse(null, `OAuth error: ${userFriendlyMessage}`, 500), 500);
    }
  }
});

// 确认合并账户并绑定 GitHub
oauthRouter.post('/github/bind/merge', authenticateJWT, async (c: HonoContext) => {
  try {
    const user = c.get('user') as User;
    const body = await c.req.json();
    const { existingUserId, githubUserId, githubUsername } = body;

    if (!existingUserId || !githubUserId) {
      return c.json(createResponse(null, 'Missing required parameters', 400), 400);
    }

    const targetUser = await oneUser(user.id);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // 检查目标用户是否已经绑定了 GitHub（避免重复绑定）
    if (targetUser.authProviderId) {
      if (targetUser.authProviderId === githubUserId) {
        throw new Error('您已绑定此 GitHub 账户');
      }
      throw new Error('目标账户已绑定其他 GitHub 账户，请先解绑');
    }

    // 验证 existingUserId 对应的用户确实绑定了这个 GitHub ID
    const existingUser = await oneUser(existingUserId);
    if (!existingUser) {
      throw new Error('Existing user not found');
    }

    if (existingUser.authProviderId !== githubUserId) {
      throw new Error('GitHub ID mismatch');
    }

    // 防止合并自己
    if (existingUserId === user.id) {
      throw new Error('Cannot merge account with itself');
    }

    // 执行账户合并（在事务中同时更新 GitHub 绑定和删除源账户）
    // 这样可以确保操作的原子性，避免唯一性约束冲突
    // mergeUserAccounts 会处理所有数据迁移，包括头像、昵称等字段的合并
    // 如果没有传递 githubUsername，尝试从 existingUser 获取
    const finalGithubUsername =
      githubUsername || existingUser.authProviderUsername || existingUser.username;
    const mergeResult = await mergeUserAccounts(existingUserId, user.id, {
      providerUserId: githubUserId,
      providerUsername: finalGithubUsername,
      updateProviderBinding: true,
    });

    // 验证源账户已被删除
    const verifyDeleted = await oneUser(existingUserId);
    if (verifyDeleted) {
      console.error(`Error: Source user ${existingUserId} still exists after merge`);
      throw new Error('账户合并失败：源账户未被删除');
    }

    // 注意：头像更新已经在 mergeUserAccounts 函数的事务中处理了，不需要再次更新

    return c.json(
      createResponse(
        {
          merged: true,
          mergedData: mergeResult.mergedData,
        },
        '账户合并成功，GitHub 已绑定'
      ),
      200
    );
  } catch (error: any) {
    console.error('Merge and bind error:', error);
    return c.json(
      createResponse(null, error.message || 'Failed to merge accounts and bind GitHub', 500),
      500
    );
  }
});

// 解绑 GitHub 账户
oauthRouter.delete('/github/bind', authenticateJWT, async (c: HonoContext) => {
  try {
    const user = c.get('user') as User;
    const fullUser = await oneUser(user.id);

    if (!fullUser) {
      throw new Error('User not found');
    }

    // 检查用户是否已绑定 GitHub
    if (!fullUser.authProviderId) {
      return c.json(createResponse(null, '您尚未绑定 GitHub 账户', 400), 400);
    }

    // 检查用户是否有密码（如果没有密码且解绑 GitHub，则无法登录）
    if (!fullUser.passwordhash || !fullUser.salt) {
      if (fullUser.authProvider === 'github') {
        return c.json(createResponse(null, '无法解绑：您没有设置密码，解绑后将无法登录', 400), 400);
      }
    }

    // 解绑 GitHub：清除 authProviderId 和 authProviderUsername，如果 authProvider 是 github 则改为 local
    const updateData: any = {
      authProviderId: null,
      authProviderUsername: null,
      updatedAt: new Date(),
    };

    if (fullUser.authProvider === 'github') {
      updateData.authProvider = 'local';
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    return c.json(createResponse(null, 'GitHub 账户已解绑'), 200);
  } catch (error: any) {
    console.error('Unbind GitHub error:', error);
    return c.json(
      createResponse(null, error.message || 'Failed to unbind GitHub account', 500),
      500
    );
  }
});

export default oauthRouter;
