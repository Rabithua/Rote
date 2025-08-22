import axios from 'axios';
import { post } from './api';

export type PresignFile = { filename?: string; contentType?: string; size?: number };

export type PresignItem = {
  uuid: string;
  original: { key: string; putUrl: string; url: string; contentType?: string };
  compressed: { key: string; putUrl: string; url: string; contentType: 'image/webp' };
};

export async function presign(files: PresignFile[]) {
  const res = (await post('/attachments/presign', { files })) as any;
  if (res.code !== 0) throw new Error(res.message || 'presign failed');
  return res.data.items as PresignItem[];
}

export async function uploadToSignedUrl(putUrl: string, blob: Blob) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Empty upload payload');
  }

  const resp = await axios.put(putUrl, blob, {
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
    },
    transformRequest: [(data) => data as any],
    transitional: { clarifyTimeoutError: true },
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const reqId = resp.headers?.['x-amz-request-id'] || resp.headers?.['cf-ray'] || '';
    const bodyText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data || {});
    throw new Error(`Upload failed: ${resp.status} ${reqId} ${bodyText}`);
  }
}

export type FinalizeAttachment = {
  uuid: string;
  originalKey: string;
  compressedKey?: string;
  size?: number;
  mimetype?: string;
  hash?: string;
};

export async function finalize(attachments: FinalizeAttachment[], noteId?: string) {
  const res = (await post('/attachments/finalize', { attachments, noteId })) as any;
  if (res.code !== 0) throw new Error(res.message || 'finalize failed');
  return res.data as any[];
}
