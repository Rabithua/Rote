export interface SystemConfig {
  site?: {
    name: string;
    frontendUrl: string;
    description?: string;
    defaultLanguage?: string;
    allowedOrigins?: string[];
    icpRecord?: string;
    announcement?: {
      enabled: boolean;
      content: string;
      link?: string;
    };
    customHeadScripts?: string;
  };
  storage?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    urlPrefix: string;
    region?: string;
  };
  security?: {
    requireCertifiedUserForExplore?: boolean;
    // TODO: 下下次更新移除 requireVerifiedEmailForExplore 旧配置键兼容。
    requireVerifiedEmailForExplore?: boolean;
    oauth?: {
      enabled?: boolean;
      providers?: Record<string, any>;
    };
  };
  ui?: {
    theme?: string;
    language?: string;
    allowRegistration?: boolean;
    defaultUserRole?: string;
    apiRateLimit?: number;
    allowUploadFile?: boolean;
    maxVideoUploadSizeMB?: number;
  };
  notification?: {
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
    adminHooks?: AdminHooksConfig;
  };
  ai?: {
    enabled?: boolean;
    vectorEnabled?: boolean;
    autoIndexEnabled?: boolean;
    publicExploreVectorEnabled?: boolean;
    chat?: AiProviderConfig;
    embedding?: AiProviderConfig & {
      dimensions?: number;
    };
    indexing?: {
      chunkSize?: number;
      chunkOverlap?: number;
      batchSize?: number;
      maxRetries?: number;
      paused?: boolean;
    };
  };
}

export type AdminHookEvent = 'user.registered' | 'note.public.created';

export type AdminHookChannel =
  | {
      enabled: boolean;
      events: AdminHookEvent[];
      group?: string;
      icon?: string;
      id: string;
      key: string;
      name: string;
      serverUrl?: string;
      sound?: string;
      type: 'bark';
    }
  | {
      enabled: boolean;
      events: AdminHookEvent[];
      headers?: Record<string, string>;
      id: string;
      name: string;
      type: 'http';
      url: string;
    }
  | {
      enabled: boolean;
      events: AdminHookEvent[];
      id: string;
      name: string;
      type: 'admin_pwa';
    };

export interface AdminHooksConfig {
  enabled: boolean;
  channels: AdminHookChannel[];
}

export interface AiProviderConfig {
  providerId: string;
  apiFormat?: 'openai_compatible';
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface AiProviderPreset {
  id: string;
  name: string;
  apiFormat: 'openai_compatible';
  baseUrl: string;
  capabilities: Array<'chat' | 'embedding'>;
  chatModels: string[];
  embeddingModels: string[];
  requiresApiKey: boolean;
}

export interface DashboardStats {
  globalStats: {
    users: number;
    rotes: number;
    articles: number;
    attachments: number;
    embeddingJobs: {
      pending: number;
      running: number;
      succeeded: number;
      failed: number;
    };
  };
  topUsersByNotes: Array<{
    id: string;
    username: string;
    email: string;
    nickname: string | null;
    avatar: string | null;
    roteCount: number;
    articleCount: number;
    createdAt: string;
  }>;
  topUsersByApi: Array<{
    id: string;
    username: string;
    email: string;
    nickname: string | null;
    avatar: string | null;
    apiCallCount: number;
  }>;
  topUsersByStorage: Array<{
    id: string;
    username: string;
    email: string;
    nickname: string | null;
    avatar: string | null;
    storageUsage: number | string;
  }>;
  topUsersByTokenUsage: Array<{
    id: string;
    username: string;
    email: string;
    nickname: string | null;
    avatar: string | null;
    tokenUsage: number | string;
  }>;
}
