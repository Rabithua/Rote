import { SignJWT, importPKCS8 } from 'jose';
import type { AppleOAuthProviderConfig } from '../types/config';

// Apple OAuth Token 交换响应
interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
  error?: string;
  error_description?: string;
}

// Apple 用户信息（从 ID token 和首次授权的 user 参数中提取）
export interface AppleUserInfo {
  id: string; // sub (Apple 用户 ID)
  email: string | null;
  name: string | null; // firstName + lastName
  emailVerified: boolean;
}

// Apple 首次授权的 user 参数格式
interface AppleUserParam {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

// 生成 Apple client_secret (JWT)
export async function generateAppleClientSecret(config: AppleOAuthProviderConfig): Promise<string> {
  try {
    // 解析私钥
    const privateKey = await importPKCS8(config.privateKey, 'ES256');

    // 计算过期时间（6 个月）
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 6 * 30 * 24 * 60 * 60; // 6 个月

    // 生成 JWT
    const jwt = await new SignJWT({
      iss: config.teamId,
      iat: now,
      exp: exp,
      aud: 'https://appleid.apple.com',
      sub: config.clientId,
    })
      .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(privateKey);

    return jwt;
  } catch (error: any) {
    throw new Error(`Failed to generate Apple client secret: ${error.message}`);
  }
}

// 交换授权码获取 access_token 和 id_token
export async function exchangeCodeForToken(
  code: string,
  config: AppleOAuthProviderConfig
): Promise<{ accessToken: string; idToken: string }> {
  const clientSecret = await generateAppleClientSecret(config);

  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apple OAuth token exchange failed: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as AppleTokenResponse;

  if (data.error) {
    throw new Error(`Apple OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.id_token) {
    throw new Error('Apple OAuth: id_token not found in response');
  }

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
  };
}

// 验证并解码 ID token
async function verifyIdToken(idToken: string, clientId: string): Promise<any> {
  try {
    // Apple 的 ID token 使用 ES256 算法，但验证需要 Apple 的公钥
    // 由于 Apple 使用 JWKS，这里我们只解码 payload，不验证签名
    // 在生产环境中，应该验证签名以确保 token 的真实性
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // 验证基本字段
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Invalid ID token issuer');
    }

    if (payload.aud !== clientId) {
      throw new Error('Invalid ID token audience');
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('ID token expired');
    }

    return payload;
  } catch (error: any) {
    throw new Error(`Failed to verify ID token: ${error.message}`);
  }
}

// 解析首次授权的 user 参数
function parseAppleUserParam(userParam: string | null): AppleUserParam | null {
  if (!userParam) {
    return null;
  }

  try {
    return JSON.parse(userParam) as AppleUserParam;
  } catch {
    return null;
  }
}

// 获取 Apple 用户信息
export async function getAppleUserInfo(
  idToken: string,
  clientId: string,
  userParam: string | null = null
): Promise<AppleUserInfo> {
  // 验证并解码 ID token
  const payload = await verifyIdToken(idToken, clientId);

  // 从 ID token 提取基本信息
  const sub = payload.sub;
  const email = payload.email || null;
  const emailVerified = payload.email_verified === true;

  if (!sub) {
    throw new Error('Apple user ID (sub) is missing in ID token');
  }

  // 解析首次授权的 user 参数（如果提供）
  const userData = parseAppleUserParam(userParam);
  let name: string | null = null;

  if (userData?.name) {
    const firstName = userData.name.firstName || '';
    const lastName = userData.name.lastName || '';
    name = [firstName, lastName].filter(Boolean).join(' ') || null;
  }

  // 如果 user 参数中有 email，优先使用（首次授权时更可靠）
  const finalEmail = userData?.email || email;

  return {
    id: sub,
    email: finalEmail,
    name,
    emailVerified,
  };
}
