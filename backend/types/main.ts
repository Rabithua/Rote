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
