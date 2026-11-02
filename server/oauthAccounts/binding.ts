import { eq } from 'drizzle-orm';
import { authorizeOAuthAccountMerge } from '../accountMerge/authorization';
import { users } from '../drizzle/schema';
import type { HonoContext } from '../types/hono';
import {
  bindOAuthProvider,
  findUserByOAuthBinding,
  getUserOAuthBindings,
} from '../utils/dbMethods/userOAuth';
import { oneUser } from '../utils/dbMethods/user';
import db from '../utils/drizzle';
import type { OAuthUserInfo } from '../utils/oauth/providers/base';
import { getFrontendBaseUrl } from './redirects';
import messages from './messages.json';

export async function completeOAuthBinding(
  c: HonoContext,
  providerName: string,
  oauthUser: OAuthUserInfo,
  stateData: any
): Promise<Response> {
  // 绑定模式：将 OAuth 账户绑定到现有用户
  const targetUserId = stateData.userId as string;
  const targetUser = await oneUser(targetUserId);

  if (!targetUser) {
    throw new Error(messages.targetUserNotFound);
  }

  // 检查目标用户是否已经绑定了该 OAuth 提供商（防止在授权过程中状态改变）
  const existingBindings = await getUserOAuthBindings(targetUserId);
  const hasBinding = existingBindings.some((binding) => binding.provider === providerName);
  if (hasBinding) {
    throw new Error(messages.providerAlreadyBound.replace('{provider}', providerName));
  }

  // 检查 OAuth ID 是否已被使用
  const existingOAuthUser = await findUserByOAuthBinding(providerName, oauthUser.id);

  if (existingOAuthUser) {
    // 如果这个 OAuth ID 已经被其他用户使用，返回需要合并的信息
    if (existingOAuthUser.id !== targetUserId) {
      await authorizeOAuthAccountMerge({
        targetUserId,
        sourceUserId: existingOAuthUser.id,
        provider: providerName,
        providerId: oauthUser.id,
      });
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
