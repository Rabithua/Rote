// OAuth 用户信息通用接口
export interface OAuthUserInfo {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  avatar?: string | null;
  [key: string]: any; // 允许提供商特定的额外字段
}

// OAuth 提供商配置基类
export interface BaseOAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  callbackUrl: string;
  scopes?: string[];
}

// OAuth 提供商抽象接口
export interface OAuthProvider {
  // 提供商名称（如 'github', 'apple'）
  readonly name: string;

  // 回调方法类型（'GET' | 'POST'）
  readonly callbackMethod: 'GET' | 'POST';

  // 是否需要在查找用户时同时检查 authProvider 字段
  // GitHub/Apple 为 false（因为合并账户后 authProvider 可能是 'local'）
  // 其他提供商为 true（需要同时匹配 authProvider 和 authProviderId）
  readonly requiresAuthProviderInLookup: boolean;

  // 验证配置
  validateConfig(config: any): Promise<void>;

  // 生成授权 URL
  getAuthUrl(config: any, state: string, redirectUrl: string): string;

  // 交换授权码获取 token
  exchangeCode(code: string, config: any, additionalParams?: any): Promise<any>;

  // 获取用户信息
  getUserInfo(tokenData: any, config: any, additionalParams?: any): Promise<OAuthUserInfo>;

  // 返回配置结构定义（用于前端表单生成）
  getConfigSchema(): {
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'password' | 'textarea';
      required: boolean;
      placeholder?: string;
      description?: string;
    }>;
  };

  // 返回提供商特定的错误消息列表（用于错误处理）
  getErrorMessages(): string[];
}
