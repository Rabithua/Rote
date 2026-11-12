import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import type { HonoContext } from '../types/hono';
import type { AppleOAuthProviderConfig } from '../types/config';
import { users } from '../drizzle/schema';
import db from '../utils/drizzle';
import { oneUser } from '../utils/dbMethods/user';
import {
  bindOAuthProvider,
  findUserByOAuthBinding,
  getUserOAuthBindings,
} from '../utils/dbMethods/userOAuth';
import { authorizeOAuthAccountMerge } from '../accountMerge/authorization';
import { createResponse } from '../utils/main';
import messages from './messages.json';

// Apple 公钥缓存（jose 内部带缓存与轮换处理）
const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

// 原生 Sign in with Apple 的 id_token audience 是 App bundle ID，
// 与网页授权使用的 Services ID（config.clientId）并存。
const IOS_APP_BUNDLE_ID = 'rabithua.Rote';

export interface AppleNativeBindBody {
  identityToken?: string;
  nonce?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

class NativeAppleBindError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'NativeAppleBindError';
    this.status = status;
  }
}

/// 验证客户端上送的原生 id_token：Apple JWKS 验签 + issuer/audience/nonce。
/// 与网页流不同，这里的 token 来自客户端，签名必须验证，不可只解码 payload。
async function verifyAppleIdentityToken(
  identityToken: string,
  nonce: string,
  config: AppleOAuthProviderConfig
) {
  let payload: Record<string, any>;
  try {
    const verified = await jwtVerify(identityToken, appleJWKS, {
      issuer: 'https://appleid.apple.com',
      audience: [config.clientId, IOS_APP_BUNDLE_ID],
    });
    payload = verified.payload as Record<string, any>;
  } catch {
    throw new NativeAppleBindError(messages.nativeAppleBindInvalidToken, 403);
  }

  if (!payload.sub) {
    throw new NativeAppleBindError(messages.nativeAppleBindInvalidToken, 403);
  }

  // nonce：客户端把随机值的 SHA256 放进授权请求，随绑定请求带上原始值。
  const expectedNonce = createHash('sha256').update(nonce).digest('hex');
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new NativeAppleBindError(messages.nativeAppleBindNonceMismatch, 403);
  }

  return payload;
}

function composeNativeName(body: AppleNativeBindBody): string | null {
  return [body.firstName, body.lastName].filter(Boolean).join(' ') || null;
}

export async function completeNativeAppleBind(
  c: HonoContext,
  config: AppleOAuthProviderConfig,
  targetUserId: string,
  body: AppleNativeBindBody
): Promise<Response> {
  if (!body.identityToken || !body.nonce) {
    throw new NativeAppleBindError(messages.nativeAppleBindInvalidToken, 400);
  }

  const payload = await verifyAppleIdentityToken(body.identityToken, body.nonce, config);
  const providerName = 'apple';
  const name = composeNativeName(body);

  const targetUser = await oneUser(targetUserId);
  if (!targetUser) {
    throw new NativeAppleBindError(messages.targetUserNotFound, 404);
  }

  const existingBindings = await getUserOAuthBindings(targetUserId);
  if (existingBindings.some((binding) => binding.provider === providerName)) {
    throw new NativeAppleBindError(
      messages.providerAlreadyBound.replace('{provider}', providerName)
    );
  }

  // 该 Apple 身份已归属其他账号 → 授权合并，交由客户端确认后再调 bind/merge
  const identityOwner = await findUserByOAuthBinding(providerName, payload.sub);
  if (identityOwner && identityOwner.id !== targetUserId) {
    await authorizeOAuthAccountMerge({
      targetUserId,
      sourceUserId: identityOwner.id,
      provider: providerName,
      providerId: payload.sub,
    });
    return c.json(
      createResponse(
        {
          status: 'merge_required',
          existingUserId: identityOwner.id,
          existingUsername: identityOwner.username || '',
          existingEmail: identityOwner.email || '',
          appleUserId: payload.sub,
        },
        messages.nativeAppleBindMergeRequired
      )
    );
  }

  await bindOAuthProvider(targetUserId, providerName, payload.sub, name || undefined);

  // 昵称补全：Apple 原生不提供头像，仅在用户提供且账号缺失时补昵称
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (name && !targetUser.nickname) {
    updateData.nickname = name;
  }
  if (Object.keys(updateData).length > 1) {
    await db.update(users).set(updateData).where(eq(users.id, targetUserId));
  }

  return c.json(createResponse({ status: 'bound' }, messages.nativeAppleBindSuccess));
}
