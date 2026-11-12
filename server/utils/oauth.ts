import { SignJWT, errors, jwtVerify } from 'jose';
import { SecurityConfig } from '../types/config';
import { getGlobalConfig } from './config';

// OAuth state token payload
export interface OAuthStatePayload {
  provider?: string; // OAuth 提供商名称（如 'github', 'apple'）
  redirectUrl?: string;
  iosLogin?: boolean;
  bindMode?: boolean;
  // 绑定结果回跳 iOS App（rote://oauthbind），而不是重定向到 Web 前端
  iosBind?: boolean;
  userId?: string;
  [key: string]: any;
}

// 生成 OAuth state token（使用 JWT 签名）
export async function generateStateToken(
  payload: OAuthStatePayload,
  options?: { expiresIn?: string }
): Promise<string> {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config || !config.sessionSecret) {
    throw new Error('Session secret is not configured');
  }

  const secret = new TextEncoder().encode(config.sessionSecret);
  const expiresIn = options?.expiresIn || '5m'; // 默认 5 分钟过期，减少重放攻击窗口

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-oauth')
    .setExpirationTime(expiresIn)
    .sign(secret);
}

// 验证 OAuth state token
export async function verifyStateToken(token: string): Promise<OAuthStatePayload | null> {
  try {
    const config = getGlobalConfig<SecurityConfig>('security');
    if (!config || !config.sessionSecret) {
      throw new Error('Session secret is not configured');
    }

    const secret = new TextEncoder().encode(config.sessionSecret);
    const { payload } = await jwtVerify(token, secret, { issuer: 'rote-oauth' });

    return payload as OAuthStatePayload;
  } catch (error) {
    console.error('Failed to verify state token:', error);
    return null;
  }
}

// 提取 state 中的数据
export async function extractStateData(token: string): Promise<OAuthStatePayload | null> {
  return await verifyStateToken(token);
}

// 仅用于结果路由（错误/取消时选择回跳地址）：签名与 issuer 必须有效，但容忍过期，
// 且签发时间不得超过 24 小时。完成登录/绑定必须使用严格校验的 extractStateData，
// 过期 state 永远无法推进流程，这里只决定回跳到 App scheme 还是 Web 页面。
export async function extractStateRoutingData(
  token: string | null | undefined
): Promise<OAuthStatePayload | null> {
  if (!token) return null;

  try {
    const config = getGlobalConfig<SecurityConfig>('security');
    if (!config || !config.sessionSecret) {
      return null;
    }

    const secret = new TextEncoder().encode(config.sessionSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'rote-oauth',
      maxTokenAge: '24h',
    });

    return payload as OAuthStatePayload;
  } catch (error) {
    // jose v6 没有 ignoreExpiration：仅当签名验证通过且失败原因是 exp 过期时，
    // 从 JWTExpired.payload 取回负载用于路由；伪造、iat 超限等一律拒绝。
    if (error instanceof errors.JWTExpired && error.claim === 'exp') {
      return error.payload as OAuthStatePayload;
    }
    return null;
  }
}
