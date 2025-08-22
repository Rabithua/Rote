declare global {
  namespace Express {
    interface Request {
      dynamicApiUrl: string;
      dynamicFrontendUrl: string;
    }
  }
}

export interface UploadResult {
  url: string | null;
  compressUrl: string | null;
  details: {
    size: number;
    mimetype: string | null;
    mtime: Date | null | undefined;
    hash: string | null | undefined;
    // 对象存储中的 Key，便于删除和追踪
    key?: string;
    compressKey?: string;
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
