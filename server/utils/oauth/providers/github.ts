import { Octokit } from '@octokit/rest';
import type { OAuthProviderConfig } from '../../../types/config';
import type { OAuthProvider, OAuthUserInfo } from './base';

// GitHub OAuth 授权码交换响应
interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

// GitHub 用户信息
interface GitHubUserInfo {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
}

export class GitHubOAuthProvider implements OAuthProvider {
  readonly name = 'github';
  readonly callbackMethod = 'GET' as const;
  readonly requiresAuthProviderInLookup = false; // GitHub 只根据 authProviderId 查找

  async validateConfig(config: any): Promise<void> {
    if (!config.enabled) {
      throw new Error('GitHub OAuth is disabled');
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error('GitHub OAuth clientId or clientSecret is missing');
    }

    if (!config.callbackUrl) {
      throw new Error('GitHub OAuth callbackUrl is missing');
    }
  }

  getAuthUrl(config: OAuthProviderConfig, state: string, _redirectUrl: string): string {
    const scopes = config.scopes || ['user:email'];
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', config.clientId);
    githubAuthUrl.searchParams.set('redirect_uri', config.callbackUrl);
    githubAuthUrl.searchParams.set('scope', scopes.join(' '));
    githubAuthUrl.searchParams.set('state', state);
    return githubAuthUrl.toString();
  }

  async exchangeCode(
    code: string,
    config: OAuthProviderConfig,
    _additionalParams?: any
  ): Promise<string> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub OAuth token exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubTokenResponse;

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    if (!data.access_token) {
      throw new Error('GitHub OAuth: access_token not found in response');
    }

    return data.access_token;
  }

  async getUserInfo(
    accessToken: string,
    _config: any,
    _additionalParams?: any
  ): Promise<OAuthUserInfo> {
    return await this.getGitHubUserInfo(accessToken);
  }

  private async getGitHubUserInfo(accessToken: string, retries = 3): Promise<GitHubUserInfo> {
    const octokit = new Octokit({
      auth: accessToken,
      request: {
        timeout: 10000, // 10 秒超时
      },
    });

    try {
      // 获取用户基本信息
      const { data: user } = await octokit.rest.users.getAuthenticated();

      // 获取用户邮箱列表
      let email: string | null = null;
      try {
        const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
        // 优先返回主邮箱且已验证的邮箱
        const primaryEmail = emails.find((e) => e.primary && e.verified)?.email;
        const verifiedEmail = emails.find((e) => e.verified)?.email;
        email = primaryEmail || verifiedEmail || emails[0]?.email || null;
      } catch (emailError: any) {
        // 如果没有 user:email scope，可能无法获取邮箱
        console.warn('Failed to fetch GitHub email:', emailError.message);
        // 尝试使用用户公开邮箱
        email = user.email || null;
      }

      return {
        id: user.id.toString(),
        username: user.login,
        email,
        name: user.name || null,
        avatar: user.avatar_url || null,
        bio: user.bio || null,
      };
    } catch (error: any) {
      // 处理限流错误
      if ((error.status === 403 || error.status === 429) && retries > 0) {
        const retryAfter = parseInt(error.response?.headers['retry-after'] || '1');
        await sleep(retryAfter * 1000);
        return this.getGitHubUserInfo(accessToken, retries - 1);
      }
      throw error;
    }
  }

  getConfigSchema() {
    return {
      fields: [
        {
          name: 'clientId',
          label: 'Client ID',
          type: 'text' as const,
          required: true,
          placeholder: 'GitHub OAuth App Client ID',
        },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          type: 'password' as const,
          required: true,
          placeholder: 'GitHub OAuth App Client Secret',
        },
        {
          name: 'callbackUrl',
          label: 'Callback URL',
          type: 'text' as const,
          required: true,
          placeholder: '/auth/oauth/github/callback',
          description: 'OAuth 回调 URL，需要在 GitHub OAuth App 中配置',
        },
      ],
    };
  }

  getErrorMessages(): string[] {
    return [
      '该邮箱已被其他账户使用',
      '该 GitHub 账户已被其他用户使用',
      '该 GitHub 账户已被其他用户使用，无法绑定到此账户',
      '该 GitHub 账户已被其他用户使用。如果这是您的账户，请使用该账户登录后绑定，或联系管理员合并账户',
      '账户合并失败',
      '您已绑定此 GitHub 账户',
      '您的账户已绑定其他 GitHub 账户，请先解绑',
      'Invalid or expired state token',
      'Missing code or state parameter',
      'OAuth error: access_denied',
      'Target user not found',
    ];
  }
}

// 辅助函数：延迟
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
