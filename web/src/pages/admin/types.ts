export interface SystemConfig {
  site?: {
    name: string;
    frontendUrl: string;
    description?: string;
    defaultLanguage?: string;
    allowedOrigins?: string[];
    icpRecord?: string;
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
  };
}
