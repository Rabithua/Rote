export interface SystemConfig {
  site?: {
    name: string;
    frontendUrl: string;
    description?: string;
    defaultLanguage?: string;
    allowedOrigins?: string[];
  };
  storage?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    urlPrefix: string;
  };
  security?: {
    requireVerifiedEmailForExplore?: boolean;
    oauth?: {
      enabled?: boolean;
      providers?: {
        github?: {
          enabled?: boolean;
          clientId?: string;
          clientSecret?: string;
          callbackUrl?: string;
          scopes?: string[];
        };
        apple?: {
          enabled?: boolean;
          clientId?: string;
          teamId?: string;
          keyId?: string;
          privateKey?: string;
          callbackUrl?: string;
          scopes?: string[];
        };
      };
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
