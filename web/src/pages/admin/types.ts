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
  ui?: {
    theme?: string;
    language?: string;
    allowRegistration?: boolean;
    defaultUserRole?: string;
    apiRateLimit?: number;
    allowUploadFile?: boolean;
  };
}
