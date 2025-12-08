import { Octokit } from '@octokit/rest';
import type { OAuthProviderConfig } from '../types/config';

// GitHub OAuth 授权码交换响应
interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

// GitHub 用户信息
export interface GitHubUserInfo {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
}

// 交换授权码获取 access_token
export async function exchangeCodeForToken(
  code: string,
  config: OAuthProviderConfig
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

// 创建 GitHub API 客户端
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    request: {
      timeout: 10000, // 10 秒超时
    },
  });
}

// 获取 GitHub 用户信息（带重试）
export async function getGitHubUserInfo(accessToken: string, retries = 3): Promise<GitHubUserInfo> {
  const octokit = createGitHubClient(accessToken);

  try {
    // 获取用户基本信息
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // 获取用户邮箱列表
    let email: string | null = null;
    try {
      const { data: emails } = await octokit.rest.users.listEmailsForAuthenticated();
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
      return getGitHubUserInfo(accessToken, retries - 1);
    }
    throw error;
  }
}

// 辅助函数：延迟
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
