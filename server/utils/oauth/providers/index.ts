import { AppleOAuthProvider } from './apple';
import { GitHubOAuthProvider } from './github';
import { oauthProviderRegistry } from './registry';

// 注册所有 OAuth 提供商
oauthProviderRegistry.registerProvider(new GitHubOAuthProvider());
oauthProviderRegistry.registerProvider(new AppleOAuthProvider());

// 导出类型和实例
export { AppleOAuthProvider } from './apple';
export type { OAuthProvider, OAuthUserInfo } from './base';
export { GitHubOAuthProvider } from './github';
export { oauthProviderRegistry } from './registry';
