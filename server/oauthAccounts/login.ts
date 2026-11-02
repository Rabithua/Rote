import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';
import type { HonoContext } from '../types/hono';
import { bindOAuthProvider, findUserByOAuthBinding } from '../utils/dbMethods/userOAuth';
import { createUser, generateUniqueUsername, oneUser } from '../utils/dbMethods/user';
import db from '../utils/drizzle';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import type { OAuthUserInfo } from '../utils/oauth/providers/base';
import { getFrontendBaseUrl } from './redirects';
import messages from './messages.json';

export async function completeOAuthLogin(
  c: HonoContext,
  providerName: string,
  oauthUser: OAuthUserInfo,
  stateData: any,
  additionalParams: any
): Promise<Response> {
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
        throw new Error(messages.emailAlreadyUsed.replace('{provider}', providerName));
      }
    }

    // 生成唯一用户名
    const baseUsername = oauthUser.username || `${providerName}-${oauthUser.id}`;
    const username = await generateUniqueUsername(baseUsername, providerName);

    // 如果没有邮箱，生成临时邮箱
    if (!oauthUser.id) {
      throw new Error(messages.providerUserIdMissing.replace('{provider}', providerName));
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
          throw new Error(messages.userCreationConflict);
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
}
