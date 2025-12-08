import { SignJWT, jwtVerify } from 'jose';
import { SecurityConfig } from '../types/config';
import { getGlobalConfig } from './config';

// OAuth state token payload
export interface OAuthStatePayload {
  provider?: string; // OAuth 提供商名称（如 'github', 'apple'）
  redirectUrl?: string;
  iosLogin?: boolean;
  bindMode?: boolean;
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
