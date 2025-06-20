export interface UploadResult {
  url: string | null;
  compressUrl: string | null;
  details: {
    size: number;
    mimetype: string | null;
    mtime: Date | null | undefined;
    hash: string | null | undefined;
  };
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  timestamp?: number;
  tag?: string;
  badge?: string;
  image?: string;
  vibrate?: number[];
  data?: any;
  silent?: boolean;
  requireInteraction?: boolean;
}
