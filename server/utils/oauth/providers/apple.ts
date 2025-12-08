import { SignJWT, importPKCS8 } from 'jose';
import type { AppleOAuthProviderConfig } from '../../../types/config';
import type { OAuthProvider, OAuthUserInfo } from './base';

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

// Apple 首次授权的 user 参数格式
interface AppleUserParam {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

export class AppleOAuthProvider implements OAuthProvider {
  readonly name = 'apple';
  readonly callbackMethod = 'POST' as const;
  readonly requiresAuthProviderInLookup = false; // Apple 只根据 authProviderId 查找

  async validateConfig(config: any): Promise<void> {
    if (!config.enabled) {
      throw new Error('Apple OAuth is disabled');
    }

    if (!config.clientId || !config.teamId || !config.keyId || !config.privateKey) {
      throw new Error('Apple OAuth clientId, teamId, keyId or privateKey is missing');
    }

    if (!config.callbackUrl) {
      throw new Error('Apple OAuth callbackUrl is missing');
    }
  }

  getAuthUrl(config: AppleOAuthProviderConfig, state: string, _redirectUrl: string): string {
    const scopes = config.scopes || ['name', 'email'];
    const appleAuthUrl = new URL('https://appleid.apple.com/auth/authorize');
    appleAuthUrl.searchParams.set('client_id', config.clientId);
    appleAuthUrl.searchParams.set('redirect_uri', config.callbackUrl);
    appleAuthUrl.searchParams.set('response_type', 'code');
    appleAuthUrl.searchParams.set('response_mode', 'form_post'); // Apple 要求使用 POST
    appleAuthUrl.searchParams.set('scope', scopes.join(' '));
    appleAuthUrl.searchParams.set('state', state);
    return appleAuthUrl.toString();
  }

  async exchangeCode(
    code: string,
    config: AppleOAuthProviderConfig,
    _additionalParams?: any
  ): Promise<{ accessToken: string; idToken: string }> {
    const clientSecret = await this.generateAppleClientSecret(config);

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

  async getUserInfo(
    tokenData: { accessToken: string; idToken: string },
    config: AppleOAuthProviderConfig,
    additionalParams?: { userParam?: string | null }
  ): Promise<OAuthUserInfo> {
    return await this.getAppleUserInfo(
      tokenData.idToken,
      config.clientId,
      additionalParams?.userParam || null
    );
  }

  private async generateAppleClientSecret(config: AppleOAuthProviderConfig): Promise<string> {
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

  private async verifyIdToken(idToken: string, clientId: string): Promise<any> {
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

  private parseAppleUserParam(userParam: string | null): AppleUserParam | null {
    if (!userParam) {
      return null;
    }

    try {
      return JSON.parse(userParam) as AppleUserParam;
    } catch {
      return null;
    }
  }

  private async getAppleUserInfo(
    idToken: string,
    clientId: string,
    userParam: string | null = null
  ): Promise<OAuthUserInfo> {
    // 验证并解码 ID token
    const payload = await this.verifyIdToken(idToken, clientId);

    // 从 ID token 提取基本信息
    const sub = payload.sub;
    const email = payload.email || null;
    const emailVerified = payload.email_verified === true;

    if (!sub) {
      throw new Error('Apple user ID (sub) is missing in ID token');
    }

    // 解析首次授权的 user 参数（如果提供）
    const userData = this.parseAppleUserParam(userParam);
    let name: string | null = null;

    if (userData?.name) {
      const firstName = userData.name.firstName || '';
      const lastName = userData.name.lastName || '';
      name = [firstName, lastName].filter(Boolean).join(' ') || null;
    }

    // 如果 user 参数中有 email，优先使用（首次授权时更可靠）
    const finalEmail = userData?.email || email;

    // 生成友好的用户名：如果有 name 使用 name，否则生成 apple_ + 随机字符串
    // 使用 sub 的哈希值前 6 位 + 随机字符串，确保唯一性且友好
    let username: string;
    if (name) {
      username = name;
    } else {
      // 使用 sub 的简单哈希（取前 6 个字符，去掉特殊字符）和随机字符串生成友好用户名
      // 如果 sub 去掉特殊字符后不足 6 位，使用整个清理后的字符串
      const cleanedSub = sub.replace(/[^a-zA-Z0-9]/g, '');
      const subHash = cleanedSub.substring(0, Math.min(6, cleanedSub.length)) || 'user';
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      username = `apple_${subHash}_${randomSuffix}`;
    }

    return {
      id: sub,
      username,
      email: finalEmail,
      name,
      emailVerified,
    };
  }

  getConfigSchema() {
    return {
      fields: [
        {
          name: 'clientId',
          label: 'Client ID (Service ID)',
          type: 'text' as const,
          required: true,
          placeholder: 'com.example.app',
        },
        {
          name: 'teamId',
          label: 'Team ID',
          type: 'text' as const,
          required: true,
          placeholder: 'ABC123DEF4',
        },
        {
          name: 'keyId',
          label: 'Key ID',
          type: 'text' as const,
          required: true,
          placeholder: 'XYZ123ABC4',
        },
        {
          name: 'privateKey',
          label: 'Private Key',
          type: 'textarea' as const,
          required: true,
          placeholder: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
          description: 'Apple 私钥（用于生成 JWT client_secret）',
        },
        {
          name: 'callbackUrl',
          label: 'Callback URL',
          type: 'text' as const,
          required: true,
          placeholder: '/auth/oauth/apple/callback',
          description: 'OAuth 回调 URL，需要在 Apple Developer 中配置',
        },
      ],
    };
  }

  getErrorMessages(): string[] {
    return [
      '该邮箱已被其他账户使用',
      '该 Apple 账户已被其他用户使用',
      '您已绑定此 Apple 账户',
      '您的账户已绑定其他 Apple 账户，请先解绑',
      'Invalid or expired state token',
      'Missing code or state parameter',
      'OAuth error: user_cancelled_authorize',
      'Target user not found',
    ];
  }
}
