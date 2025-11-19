// 配置分组类型
export type ConfigGroup = 'site' | 'storage' | 'security' | 'notification' | 'ui' | 'system';

// 配置项类型定义
export interface SiteConfig {
  name: string;
  url: string;
  description?: string;
  defaultLanguage?: string;
  apiUrl?: string; // 动态 API URL
  frontendUrl?: string; // 动态前端 URL
  allowedOrigins?: string[]; // CORS 允许的 origin 列表，为空或不设置则允许所有
}

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  urlPrefix: string;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshExpiry: string;
  sessionSecret: string;
}

export interface NotificationConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
}

export interface UiConfig {
  allowRegistration: boolean;
  defaultUserRole: string;
  apiRateLimit: number;
  allowUploadFile: boolean;
}

export interface SystemConfig {
  isInitialized: boolean;
  initializationVersion?: string;
  lastMigrationVersion?: string;
}

// 所有配置类型联合
export type ConfigData =
  | SiteConfig
  | StorageConfig
  | SecurityConfig
  | NotificationConfig
  | UiConfig
  | SystemConfig;

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
    url: string;
    description?: string;
    defaultLanguage?: string;
  };
  storage?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    urlPrefix: string;
  };
  ui: {
    allowRegistration: boolean;
    defaultUserRole: string;
    apiRateLimit: number;
    allowUploadFile: boolean;
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
