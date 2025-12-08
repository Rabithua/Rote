import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { User } from '../../drizzle/schema';
import { users } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { SecurityConfig, SiteConfig } from '../../types/config';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { getConfig } from '../../utils/config';
import {
  bindOAuthProvider,
  findUserByOAuthBinding,
  getUserOAuthBindings,
  mergeUserAccounts,
  unbindOAuthProvider,
} from '../../utils/dbMethods';
import { createUser, generateUniqueUsername, oneUser } from '../../utils/dbMethods/user';
import db from '../../utils/drizzle';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { createResponse } from '../../utils/main';
import { extractStateData, generateStateToken } from '../../utils/oauth';
// 导入提供商注册器（这会自动注册所有提供商）
import '../../utils/oauth/providers';
import { oauthProviderRegistry } from '../../utils/oauth/providers';

const oauthRouter = new Hono<{ Variables: HonoVariables }>();

// 验证 redirectUrl 防止开放重定向攻击
function validateRedirectUrl(redirectUrl: string | null | undefined, defaultUrl: string): string {
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

// 获取前端基础 URL
async function getFrontendBaseUrl(c: HonoContext): Promise<string> {
  const siteConfig = await getConfig<SiteConfig>('site');
  const dynamicFrontendUrl = c.get('dynamicFrontendUrl') as string | undefined;
  return dynamicFrontendUrl || siteConfig?.frontendUrl || 'http://localhost:3001';
}

// 处理 OAuth 错误重定向
async function handleOAuthError(
  c: HonoContext,
  error: any,
  provider: string,
  stateData: any | null
): Promise<Response> {
  const providerInstance = oauthProviderRegistry.getProvider(provider);
  const errorMessages = providerInstance?.getErrorMessages() || [];

  // 区分用户友好错误和系统错误，避免泄露敏感信息
  let userFriendlyMessage = `${provider} OAuth authentication failed`;
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
      const loginUrl = new URL('/login', frontendBaseUrl);
      loginUrl.searchParams.set('oauth', 'error');
      loginUrl.searchParams.set('provider', provider);
      loginUrl.searchParams.set('message', userFriendlyMessage);
      return c.redirect(loginUrl.toString());
    }
  } catch (_redirectError) {
    // 如果重定向失败，返回 JSON 错误
    return c.json(createResponse(null, `OAuth error: ${userFriendlyMessage}`, 500), 500);
  }
}

// 处理用户取消授权
async function handleOAuthCancelled(
  c: HonoContext,
  provider: string,
  _errorCode: string
): Promise<Response> {
  const frontendBaseUrl = await getFrontendBaseUrl(c);
  const loginUrl = new URL('/login', frontendBaseUrl);
  loginUrl.searchParams.set('oauth', 'cancelled');
  loginUrl.searchParams.set('provider', provider);
  return c.redirect(loginUrl.toString());
}

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
      return await handleOAuthCancelled(c, providerName, error);
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
      // 绑定模式：将 OAuth 账户绑定到现有用户
      const targetUserId = stateData.userId as string;
      const targetUser = await oneUser(targetUserId);

      if (!targetUser) {
        throw new Error('Target user not found');
      }

      // 检查目标用户是否已经绑定了该 OAuth 提供商（防止在授权过程中状态改变）
      const existingBindings = await getUserOAuthBindings(targetUserId);
      const hasBinding = existingBindings.some((binding) => binding.provider === providerName);
      if (hasBinding) {
        throw new Error(`您已绑定此 ${providerName} 账户`);
      }

      // 检查 OAuth ID 是否已被使用
      const existingOAuthUser = await findUserByOAuthBinding(providerName, oauthUser.id);

      if (existingOAuthUser) {
        // 如果这个 OAuth ID 已经被其他用户使用，返回需要合并的信息
        if (existingOAuthUser.id !== targetUserId) {
          const frontendBaseUrl = await getFrontendBaseUrl(c);
          const redirectUrl = stateData.redirectUrl || '/profile';
          const bindUrl = new URL(redirectUrl, frontendBaseUrl);
          bindUrl.searchParams.set('oauth', 'bind');
          bindUrl.searchParams.set('bind', 'merge_required');
          bindUrl.searchParams.set('provider', providerName);
          bindUrl.searchParams.set('existingUserId', existingOAuthUser.id);
          bindUrl.searchParams.set('existingUsername', existingOAuthUser.username || '');
          bindUrl.searchParams.set('existingEmail', existingOAuthUser.email || '');
          bindUrl.searchParams.set(`${providerName}UserId`, oauthUser.id);
          bindUrl.searchParams.set(
            `${providerName}Username`,
            oauthUser.username || oauthUser.name || ''
          );
          return c.redirect(bindUrl.toString());
        }
      }

      // 创建 OAuth 绑定记录
      await bindOAuthProvider(
        targetUserId,
        providerName,
        oauthUser.id,
        oauthUser.username || oauthUser.name || undefined
      );

      // 更新用户信息（头像和昵称，如果 OAuth 有且用户没有）
      const updateData: any = {
        updatedAt: new Date(),
      };

      // 更新头像和昵称（如果 OAuth 有且用户没有）
      if (oauthUser.avatar && !targetUser.avatar) {
        updateData.avatar = oauthUser.avatar;
      }
      if (oauthUser.name && !targetUser.nickname) {
        updateData.nickname = oauthUser.name;
      }

      if (Object.keys(updateData).length > 1) {
        // 有需要更新的字段（除了 updatedAt）
        await db.update(users).set(updateData).where(eq(users.id, targetUserId));
      }

      // 绑定成功，重定向回前端
      const frontendBaseUrl = await getFrontendBaseUrl(c);
      const redirectUrl = stateData.redirectUrl || '/profile';
      const bindUrl = new URL(redirectUrl, frontendBaseUrl);
      bindUrl.searchParams.set('oauth', 'bind');
      bindUrl.searchParams.set('bind', 'success');
      bindUrl.searchParams.set('provider', providerName);
      return c.redirect(bindUrl.toString());
    }

    // 登录模式：创建新用户或登录已有用户
    // 查找是否已存在该 OAuth 用户
    let user = await findUserByOAuthBinding(providerName, oauthUser.id);

    if (!user) {
      // 检查邮箱是否已被其他账户使用
      // 注意：现在支持多绑定，所以不再检查 authProvider
      // 如果邮箱已被使用，用户可以通过绑定功能关联账户
      if (oauthUser.email) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, oauthUser.email))
          .limit(1);

        if (existingUser && existingUser.id !== user.id) {
          // 如果邮箱已被其他用户使用，提示用户可以通过绑定功能关联
          throw new Error(
            `该邮箱已被其他账户使用，请使用用户名密码登录后关联 ${providerName} 账户`
          );
        }
      }

      // 生成唯一用户名
      const baseUsername = oauthUser.username || `${providerName}-${oauthUser.id}`;
      const username = await generateUniqueUsername(baseUsername, providerName);

      // 如果没有邮箱，生成临时邮箱
      if (!oauthUser.id) {
        throw new Error(`${providerName} user ID is missing`);
      }
      const email = oauthUser.email || `${providerName}-${oauthUser.id}@temp.rote.local`;

      // 创建新用户
      try {
        user = await createUser({
          username,
          email,
          nickname: oauthUser.name || oauthUser.username || undefined,
          avatar: oauthUser.avatar ?? undefined,
        });

        // 创建用户后，立即创建 OAuth 绑定记录
        await bindOAuthProvider(
          user.id,
          providerName,
          oauthUser.id,
          oauthUser.username || oauthUser.name || undefined
        );
      } catch (createError: any) {
        // 处理唯一约束冲突（并发情况）
        if (createError.code === '23505') {
          // 重新查找用户
          user = await findUserByOAuthBinding(providerName, oauthUser.id);
          if (!user) {
            throw new Error('Failed to create user due to conflict');
          }
        } else {
          throw createError;
        }
      }
    } else {
      // 用户已存在，如果是首次授权且之前没有保存 name/email，需要更新（仅对 Apple）
      if (providerName === 'apple' && additionalParams.userParam) {
        const updateData: any = {};
        let needsUpdate = false;

        // 如果首次授权提供了 name 且用户当前没有 nickname，更新
        if (oauthUser.name && !user.nickname) {
          updateData.nickname = oauthUser.name;
          needsUpdate = true;
        }

        // 如果首次授权提供了 email 且用户当前是临时邮箱，更新
        if (oauthUser.email && user.email?.includes('@temp.rote.local')) {
          updateData.email = oauthUser.email;
          needsUpdate = true;
        }

        if (needsUpdate) {
          updateData.updatedAt = new Date();
          await db.update(users).set(updateData).where(eq(users.id, user.id));
          // 重新获取用户以获取最新数据
          user = await oneUser(user.id);
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
    const redirectUrl = stateData.redirectUrl || '/login';

    if (iosLogin) {
      // iOS web 登录流程：重定向到自定义 scheme
      const callbackUrl = `rote://callback?token=${jwtAccessToken}&refreshToken=${jwtRefreshToken}`;
      return c.redirect(callbackUrl);
    } else {
      // 普通 web 登录流程：重定向到登录页面，通过 URL 参数传递 tokens
      const frontendBaseUrl = await getFrontendBaseUrl(c);
      const loginUrl = new URL(redirectUrl, frontendBaseUrl);
      loginUrl.searchParams.set('oauth', 'success');
      loginUrl.searchParams.set('provider', providerName);
      loginUrl.searchParams.set('token', jwtAccessToken);
      loginUrl.searchParams.set('refreshToken', jwtRefreshToken);
      return c.redirect(loginUrl.toString());
    }
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

// 确认合并账户并绑定 OAuth
oauthRouter.post('/:provider/bind/merge', authenticateJWT, async (c: HonoContext) => {
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
    const body = await c.req.json();
    const existingUserId = body.existingUserId;
    const providerUserId = body[`${providerName}UserId`];
    const providerUsername = body[`${providerName}Username`];

    if (!existingUserId || !providerUserId) {
      return c.json(createResponse(null, 'Missing required parameters', 400), 400);
    }

    // 在合并前进行所有验证，避免竞态条件
    // 1. 验证目标用户和源用户都存在（防止在验证和合并之间被删除）
    const targetUser = await oneUser(user.id);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    const sourceUser = await oneUser(existingUserId);
    if (!sourceUser) {
      throw new Error('Source user not found');
    }

    // 2. 检查目标用户是否已经绑定了该 OAuth 提供商（避免重复绑定）
    const targetBindings = await getUserOAuthBindings(user.id);
    const hasTargetBinding = targetBindings.some((binding) => binding.provider === providerName);
    if (hasTargetBinding) {
      throw new Error(`目标账户已绑定 ${providerName} 账户，请先解绑`);
    }

    // 3. 验证 existingUserId 对应的用户确实绑定了这个 OAuth ID
    const existingUser = await findUserByOAuthBinding(providerName, providerUserId);
    if (!existingUser) {
      throw new Error('Existing user not found or OAuth binding mismatch');
    }

    if (existingUser.id !== existingUserId) {
      throw new Error(`${providerName} ID mismatch`);
    }

    // 4. 防止合并自己
    if (existingUserId === user.id) {
      throw new Error('Cannot merge account with itself');
    }

    // 5. 获取源账户的绑定信息（用于确定 providerUsername，在合并前获取）
    const existingBindings = await getUserOAuthBindings(existingUserId);
    const existingBinding = existingBindings.find((b) => b.provider === providerName);
    const finalProviderUsername =
      providerUsername || existingBinding?.providerUsername || existingUser.username;

    // 6. 执行账户合并（在事务内完成所有操作，包括 OAuth 绑定迁移）
    const mergeResult = await mergeUserAccounts(existingUserId, user.id);

    // 7. 验证源账户已被删除（合并应该在事务内完成，这里只是双重验证）
    const verifyDeleted = await oneUser(existingUserId);
    if (verifyDeleted) {
      console.error(`Error: Source user ${existingUserId} still exists after merge`);
      throw new Error('账户合并失败：源账户未被删除');
    }

    // 8. 检查该 OAuth 绑定是否已被 mergeUserAccounts 迁移
    const hasMergedBinding = mergeResult.migratedBindings.some(
      (binding) => binding.provider === providerName && binding.providerId === providerUserId
    );

    // 9. 如果绑定未被迁移（例如目标账户已有该提供商的绑定，但这种情况应该不会发生，因为前面已检查），则需要手动创建
    // 注意：这种情况理论上不应该发生，因为前面已经检查了目标账户没有该提供商的绑定
    // 但为了防御性编程，仍然处理这种情况
    if (!hasMergedBinding) {
      try {
        // 合并后创建 OAuth 绑定记录
        await bindOAuthProvider(user.id, providerName, providerUserId, finalProviderUsername);
      } catch (bindError: any) {
        // 如果创建绑定失败，记录错误但不要抛出异常
        // 因为源账户已经被删除，无法回滚，只能记录错误
        console.error(
          `Warning: Failed to create OAuth binding after merge: ${bindError.message}. ` +
            `Source account ${existingUserId} has been deleted, but binding was not created. ` +
            `This may cause data inconsistency.`
        );
        // 如果是因为唯一约束冲突（绑定已存在），这是正常的，可以忽略
        if (
          bindError.message?.includes('already bound') ||
          bindError.message?.includes('unique constraint') ||
          bindError.message?.includes('duplicate key')
        ) {
          console.log(
            `OAuth binding ${providerName}:${providerUserId} already exists, this is expected after merge`
          );
        } else {
          // 其他错误需要抛出，让调用方知道
          throw new Error(
            `账户合并成功，但创建 OAuth 绑定失败: ${bindError.message}。请检查绑定状态。`
          );
        }
      }
    } else {
      console.log(
        `OAuth binding ${providerName}:${providerUserId} was migrated during merge, skipping bind`
      );
    }

    return c.json(
      createResponse(
        {
          merged: true,
          mergedData: mergeResult.mergedData,
        },
        `账户合并成功，${providerName} 已绑定`
      ),
      200
    );
  } catch (error: any) {
    console.error(`Merge and bind error for ${c.req.param('provider')}:`, error);
    return c.json(
      createResponse(null, error.message || 'Failed to merge accounts and bind OAuth', 500),
      500
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
      return c.json(createResponse(null, '无法解绑：您没有设置密码，解绑后将无法登录', 400), 400);
    }

    // 解绑 OAuth 提供商
    await unbindOAuthProvider(user.id, providerName);

    return c.json(createResponse(null, `${providerName} 账户已解绑`), 200);
  } catch (error: any) {
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
