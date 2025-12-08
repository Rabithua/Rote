import { useAPIGet } from '@/utils/fetcher';
import { getSiteStatus } from '@/utils/setupApi';

interface SiteStatusResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
}

interface SiteStatusData {
  isInitialized: boolean;
  databaseConnected: boolean;
  site: {
    name: string;
    description: string;
    url: string;
    defaultLanguage: string;
  };
  system: {
    version: string;
    lastMigration: string;
  };
  notification: {
    vapidPublicKey: string | null;
  };
  storage: {
    r2Configured: boolean;
    urlPrefix: string;
  };
  ui: {
    allowRegistration: boolean;
    allowUploadFile: boolean;
  };
  oauth?: {
    enabled: boolean;
    providers?: {
      github?: {
        enabled: boolean;
      };
      apple?: {
        enabled: boolean;
      };
    };
  };
  timestamp: string;
}

export function useSiteStatus() {
  const { data, isLoading, error, isValidating, mutate } = useAPIGet<
    SiteStatusResponse<SiteStatusData>
  >('site-status', getSiteStatus);

  return {
    data: data?.data ?? null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

export type { SiteStatusData };
