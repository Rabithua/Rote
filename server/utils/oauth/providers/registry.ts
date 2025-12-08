import type { SecurityConfig } from '../../../types/config';
import { getConfig } from '../../config';
import type { OAuthProvider } from './base';

// OAuth 提供商注册表
class OAuthProviderRegistry {
  private providers: Map<string, OAuthProvider> = new Map();

  // 注册提供商
  registerProvider(provider: OAuthProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`OAuth provider "${provider.name}" is already registered`);
    }
    this.providers.set(provider.name, provider);
  }

  // 根据名称获取提供商
  getProvider(name: string): OAuthProvider | null {
    return this.providers.get(name) || null;
  }

  // 获取所有已注册的提供商
  getAllProviders(): OAuthProvider[] {
    return Array.from(this.providers.values());
  }

  // 验证提供商配置
  async validateProviderConfig(providerName: string, config: any): Promise<void> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`OAuth provider "${providerName}" is not registered`);
    }

    await provider.validateConfig(config);
  }

  // 获取已启用且配置有效的提供商列表
  async getEnabledProviders(): Promise<Array<{ name: string; enabled: boolean }>> {
    const securityConfig = await getConfig<SecurityConfig>('security');
    const enabledProviders: Array<{ name: string; enabled: boolean }> = [];

    if (!securityConfig?.oauth?.enabled) {
      return enabledProviders;
    }

    const providers = securityConfig.oauth.providers || {};
    for (const [name, providerConfig] of Object.entries(providers)) {
      if (providerConfig?.enabled) {
        enabledProviders.push({ name, enabled: true });
      }
    }

    return enabledProviders;
  }
}

// 导出单例实例
export const oauthProviderRegistry = new OAuthProviderRegistry();
