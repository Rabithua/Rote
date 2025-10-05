import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { SecurityConfig } from '../types/config';
import { getGlobalConfig, subscribeConfigChange } from './config';

interface CustomJWTPayload extends JWTPayload {
  userId: string;
  username: string;
}

// 配置管理
let secret: Uint8Array;
let refreshSecret: Uint8Array;
let accessExpiry: string;
let refreshExpiry: string;

// 初始化 JWT 配置
function initializeJWTConfig() {
  const config = getGlobalConfig<SecurityConfig>('security');
  if (config && config.jwtSecret && config.jwtRefreshSecret) {
    secret = new TextEncoder().encode(config.jwtSecret);
    refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);
    accessExpiry = config.jwtAccessExpiry;
    refreshExpiry = config.jwtRefreshExpiry;
  } else {
    // 如果没有有效配置，使用空值，让调用方处理
    secret = new TextEncoder().encode('');
    refreshSecret = new TextEncoder().encode('');
    accessExpiry = '15m';
    refreshExpiry = '7d';
    console.warn(
      '⚠️  JWT configuration not found or incomplete. Authentication features will be disabled.'
    );
  }
}

// 订阅配置变更
subscribeConfigChange('security', (group, newConfig: SecurityConfig) => {
  console.log('JWT configuration updated');
  if (newConfig && newConfig.jwtSecret && newConfig.jwtRefreshSecret) {
    secret = new TextEncoder().encode(newConfig.jwtSecret);
    refreshSecret = new TextEncoder().encode(newConfig.jwtRefreshSecret);
    accessExpiry = newConfig.jwtAccessExpiry;
    refreshExpiry = newConfig.jwtRefreshExpiry;
  } else {
    secret = new TextEncoder().encode('');
    refreshSecret = new TextEncoder().encode('');
    console.warn('⚠️  Invalid JWT configuration. Authentication features will be disabled.');
  }
});

// 初始化配置
initializeJWTConfig();

// 生成 Access Token (短期有效)
export async function generateAccessToken(payload: CustomJWTPayload): Promise<string> {
  if (!secret || secret.length === 0) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-app')
    .setExpirationTime(accessExpiry)
    .sign(secret);
}

// 生成 Refresh Token (长期有效)
export async function generateRefreshToken(payload: CustomJWTPayload): Promise<string> {
  if (!refreshSecret || refreshSecret.length === 0) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rote-app')
    .setExpirationTime(refreshExpiry)
    .sign(refreshSecret);
}

// 验证 Access Token
export async function verifyAccessToken(token: string): Promise<CustomJWTPayload> {
  if (!secret || secret.length === 0) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

  const { payload } = await jwtVerify(token, secret, { issuer: 'rote-app' });
  return payload as CustomJWTPayload;
}

// 验证 Refresh Token
export async function verifyRefreshToken(token: string): Promise<CustomJWTPayload> {
  if (!refreshSecret || refreshSecret.length === 0) {
    throw new Error('JWT is not configured. Please complete the security configuration first.');
  }

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
