import imageCompression from 'browser-image-compression';

export const shouldCompress = (f: File) =>
  f.type.startsWith('image/') && !f.type.startsWith('image/gif');

export const qualityForSize = (_size: number) => 0.2;

export async function maybeCompressToWebp(
  file: File,
  opts?: { maxWidthOrHeight?: number; initialQuality?: number }
) {
  if (!shouldCompress(file)) return null;

  const { maxWidthOrHeight = 2560, initialQuality = 0.2 } = opts || {};

  return imageCompression(file, {
    maxWidthOrHeight,
    initialQuality,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}

// 通用并发执行器
export async function runConcurrency<T>(
  items: T[],
  worker: (_item: T, _index: number) => Promise<void>,
  concurrency = 3
) {
  if (items.length === 0) return;
  const size = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;
  const runners = new Array(size).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      // 单项失败不影响其他
      try {
        await worker(items[idx], idx);
      } catch {
        // 忽略，交由调用方统一处理或统计
      }
    }
  });
  await Promise.all(runners);
}
