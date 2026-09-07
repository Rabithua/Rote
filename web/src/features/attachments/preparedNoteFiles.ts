import { generateVideoPoster } from '@/utils/generateVideoPoster';
import { isVideoFile, maybeCompressToWebp, runConcurrency } from '@/utils/uploadHelpers';
import type { PresignFile } from '@/utils/directUpload';

export type PreparedNoteFile = {
  file: File;
  clientId: string;
  compressed: Blob | null;
  poster: Blob | null;
};

export async function prepareNoteFiles(files: File[]): Promise<PreparedNoteFile[]> {
  const results = await runConcurrency(files, async (file) => ({
    file,
    clientId: crypto.randomUUID(),
    compressed: await maybeCompressToWebp(file),
    poster: isVideoFile(file) ? await generateVideoPoster(file) : null,
  }));
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
      ? { compressed: { contentType: 'image/webp' as const, size: item.compressed.size } }
      : {}),
    ...(item.poster
      ? { poster: { contentType: 'image/jpeg' as const, size: item.poster.size } }
      : {}),
  };
}
