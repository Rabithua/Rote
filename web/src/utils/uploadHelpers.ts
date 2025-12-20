import imageCompression from 'browser-image-compression';

export const shouldCompress = (f: File) =>
  f.type.startsWith('image/') && !f.type.startsWith('image/gif');

// 检查文件是否为 HEIC 格式（不支持）
export const isHeicFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // 检查 MIME 类型
  if (fileType === 'image/heic' || fileType === 'image/heif') {
    return true;
  }

  // 检查文件扩展名
  if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }

  return false;
};

// 根据文件大小动态调整压缩质量
// 小文件用高质量，大文件用中等质量以平衡质量和文件大小
export const qualityForSize = (size: number) => {
  // 小于 1MB 的文件使用高质量 (0.8)
  if (size < 1024 * 1024) return 0.8;
  // 1MB - 5MB 使用中等质量 (0.7)
  if (size < 5 * 1024 * 1024) return 0.7;
  // 大于 5MB 使用较低质量 (0.6) 以控制文件大小
  return 0.6;
};

export async function maybeCompressToWebp(
  file: File,
  opts?: { maxWidthOrHeight?: number; initialQuality?: number }
) {
  if (!shouldCompress(file)) return null;

  const { maxWidthOrHeight = 2560, initialQuality = qualityForSize(file.size) } = opts || {};

  return imageCompression(file, {
    maxWidthOrHeight,
    initialQuality,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}

// 任务执行结果
export interface TaskResult<T, R = void> {
  success: boolean;
  index: number;
  item: T;
  result?: R;
  error?: Error;
}

// 通用并发执行器，返回每个任务的成功/失败状态
// T: 输入项类型，R: worker 返回值类型
export async function runConcurrency<T, R = void>(
  items: T[],
  worker: (_item: T, _index: number) => Promise<R>,
  concurrency = 3
): Promise<TaskResult<T, R>[]> {
  if (items.length === 0) return [];

  const size = Math.max(1, Math.min(concurrency, items.length));
  const results: TaskResult<T, R>[] = [];

  let cursor = 0;
  const runners = new Array(size).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;

      try {
        const result = await worker(items[idx], idx);
        // 成功：添加到结果数组
        results.push({
          success: true,
          index: idx,
          item: items[idx],
          result,
        });
      } catch (error) {
        // 失败：记录错误信息
        results.push({
          success: false,
          index: idx,
          item: items[idx],
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  });

  await Promise.all(runners);

  // 按索引排序，确保结果顺序与输入顺序一致
  results.sort((a, b) => a.index - b.index);

  return results;
}
