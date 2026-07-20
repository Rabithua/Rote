// 配置分组类型
export type ConfigGroup = 'site' | 'storage' | 'security' | 'notification' | 'ui' | 'system' | 'ai';

// 配置项类型定义
export interface SiteConfig {
  name: string;
  frontendUrl: string; // 前端 URL，用于生成 RSS Feed 链接等
  customHeadScripts?: string;
  description?: string;
  defaultLanguage?: string;
  allowedOrigins?: string[]; // CORS 允许的 origin 列表，为空或不设置则允许所有
  icpRecord?: string; // ICP 备案号
  announcement?: {
    enabled: boolean;
    content: string;
    link?: string;
  };
}

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  urlPrefix: string;
  region?: string; // S3 region，默认为 'auto'
}

export interface OAuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes?: string[]; // 默认 ['user:email']
}

export interface AppleOAuthProviderConfig extends Omit<OAuthProviderConfig, 'clientSecret'> {
  teamId: string; // Apple Developer Team ID
  keyId: string; // Apple Service ID Key ID
  privateKey: string; // Apple 私钥（用于生成 JWT client_secret）
  scopes?: string[]; // 默认 ['name', 'email']
}

export interface OAuthConfig {
  enabled: boolean;
  providers: Record<string, OAuthProviderConfig | AppleOAuthProviderConfig>;
}

export interface PasskeyConfig {
  enabled?: boolean; // defaults to true
  rpName?: string; // defaults to site name
  rpId?: string; // defaults to hostname from frontendUrl
  origin?: string; // defaults to frontendUrl
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  sessionSecret: string;
  // 是否要求已认证用户才允许出现在探索页
  requireCertifiedUserForExplore?: boolean;
  // TODO: 下下次更新移除 requireVerifiedEmailForExplore 旧配置键兼容。
  requireVerifiedEmailForExplore?: boolean;
  // OAuth 配置
  oauth?: OAuthConfig;
  // Passkey 配置
  passkey?: PasskeyConfig;
}

export type AdminHookEvent = 'user.registered' | 'note.public.created';

export interface AdminHookChannelBase {
  id: string;
  name: string;
  enabled: boolean;
  events: AdminHookEvent[];
}

export interface BarkAdminHookChannel extends AdminHookChannelBase {
  type: 'bark';
  serverUrl?: string;
  key: string;
  group?: string;
  icon?: string;
  sound?: string;
}

export interface HttpAdminHookChannel extends AdminHookChannelBase {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface AdminPwaHookChannel extends AdminHookChannelBase {
  type: 'admin_pwa';
}

export type AdminHookChannel = BarkAdminHookChannel | HttpAdminHookChannel | AdminPwaHookChannel;

export interface AdminHooksConfig {
  enabled: boolean;
  channels: AdminHookChannel[];
}

export interface NotificationConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  adminHooks?: AdminHooksConfig;
}

export interface UiConfig {
  allowRegistration: boolean;
  defaultUserRole: string;
  apiRateLimit: number;
  allowUploadFile: boolean;
  maxVideoUploadSizeMB: number;
}

export interface SystemConfig {
  isInitialized: boolean;
  initializationVersion?: string;
  lastMigrationVersion?: string;
}

export interface AiProviderConfig {
  providerId: string;
  apiFormat?: 'openai_compatible';
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface AiIndexingConfig {
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
  maxRetries: number;
  paused?: boolean;
}

export interface AiConfig {
  enabled: boolean;
  vectorEnabled: boolean;
  autoIndexEnabled: boolean;
  publicExploreVectorEnabled: boolean;
  chat: AiProviderConfig;
  embedding: AiProviderConfig & {
    dimensions: number;
  };
  indexing: AiIndexingConfig;
}

// 所有配置类型联合
export type ConfigData =
  | SiteConfig
  | StorageConfig
  | SecurityConfig
  | NotificationConfig
  | UiConfig
  | SystemConfig
  | AiConfig;

// 配置更新选项
export interface ConfigUpdateOptions {
  isRequired?: boolean;
  isSystem?: boolean;
  isInitialized?: boolean;
}

// 初始化状态响应
export interface InitializationStatus {
  isInitialized: boolean;
  missingRequiredConfigs: ConfigGroup[];
  warnings: string[];
}

// 配置测试结果
export interface ConfigTestResult {
  success: boolean;
  message: string;
  details?: any;
}

// 初始化请求数据
export interface SetupRequest {
  site: {
    name: string;
    frontendUrl: string;
    description?: string;
    defaultLanguage?: string;
  };
  storage?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    urlPrefix: string;
    region?: string; // S3 region，默认为 'auto'
  };
  ui: {
    allowRegistration: boolean;
    defaultUserRole: string;
    apiRateLimit: number;
    allowUploadFile: boolean;
    maxVideoUploadSizeMB: number;
  };
  admin: {
    username: string;
    email: string;
    password: string;
    nickname?: string;
  };
}

// 初始化响应数据
export interface SetupResponse {
  success: boolean;
  message: string;
  data?: {
    adminUser: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
    generatedKeys: {
      jwtSecret: string;
      jwtRefreshSecret: string;
      sessionSecret: string;
      vapidPublicKey: string;
      vapidPrivateKey: string;
    };
  };
}
