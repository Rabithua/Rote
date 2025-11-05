import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { SecurityConfig } from '../types/config';
import { getGlobalConfig } from './config';

interface CustomJWTPayload extends JWTPayload {
  userId: string;
  username: string;
}

// JWT 配置管理 - 统一由配置管理器处理，这里只提供工具函数

// 生成 Access Token (短期有效)
export async function generateAccessToken(payload: CustomJWTPayload): Promise<string> {
  // 动态获取配置
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config || !config.jwtSecret) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  const secret = new TextEncoder().encode(config.jwtSecret);
  const expiry = config.jwtAccessExpiry || '15m';

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-app')
    .setExpirationTime(expiry)
    .sign(secret);
}

// 生成 Refresh Token (长期有效)
export async function generateRefreshToken(payload: CustomJWTPayload): Promise<string> {
  // 动态获取配置
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config || !config.jwtRefreshSecret) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);
  const expiry = config.jwtRefreshExpiry || '7d';

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-app')
    .setExpirationTime(expiry)
    .sign(refreshSecret);
}

// 验证 Access Token
export async function verifyAccessToken(token: string): Promise<CustomJWTPayload> {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config || !config.jwtSecret) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  const secret = new TextEncoder().encode(config.jwtSecret);
  const { payload } = await jwtVerify(token, secret, { issuer: 'rote-app' });
  return payload as CustomJWTPayload;
}

// 验证 Refresh Token
export async function verifyRefreshToken(token: string): Promise<CustomJWTPayload> {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (!config || !config.jwtRefreshSecret) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: 'rote-app',
  });
  return payload as CustomJWTPayload;
}

// 解析 Token 但不验证（用于获取过期 token 的信息）
export function decodeToken(token: string): CustomJWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload as CustomJWTPayload;
  } catch {
    return null;
  }
}
