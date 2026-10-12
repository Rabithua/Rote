import { generateVideoPoster } from '@/utils/generateVideoPoster';
import { isVideoFile, generateImageThumbnail, runConcurrency } from '@/utils/uploadHelpers';
import type { ImageThumbnail } from '@/utils/uploadHelpers';
import type { PresignFile } from '@/utils/directUpload';

export type PreparedNoteFile = {
  file: File;
  clientId: string;
  compressed: ImageThumbnail | null;
  poster: Blob | null;
  dimensions?: { width: number; height: number } | null;
};

async function readMediaDimensions(
  blob: Blob | null
): Promise<{ width: number; height: number } | null> {
  if (!blob || typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
  } catch {
    return null;
  }
}

export async function prepareNoteFiles(files: File[]): Promise<PreparedNoteFile[]> {
  const results = await runConcurrency(files, async (file) => {
    const compressed = await generateImageThumbnail(file);
    const poster = isVideoFile(file) ? await generateVideoPoster(file) : null;
    return {
      file,
      clientId: crypto.randomUUID(),
      compressed,
      poster,
      dimensions: await readMediaDimensions(
        compressed ?? poster ?? (isVideoFile(file) ? null : file)
      ),
    };
  });
  return results.map((result) => {
    if (!result.success) throw result.error;
    return result.result!;
  });
}

export function noteFileManifest(item: PreparedNoteFile): PresignFile {
  return {
    filename: item.file.name,
    contentType: item.file.type,
    size: item.file.size,
    ...(item.compressed
      ? {
          compressedContentType: item.compressed.type,
          compressed: { contentType: item.compressed.type, size: item.compressed.size },
        }
      : {}),
    ...(item.poster
      ? { poster: { contentType: 'image/jpeg' as const, size: item.poster.size } }
      : {}),
  };
}
