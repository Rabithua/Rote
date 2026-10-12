import imageCompression from 'browser-image-compression';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImageThumbnail } from './uploadHelpers';
import { noteFileManifest } from '@/features/attachments/preparedNoteFiles';

vi.mock('browser-image-compression', () => ({ default: vi.fn() }));

beforeEach(() => vi.mocked(imageCompression).mockReset());

const original = () => new File(['original'], 'photo.jpg', { type: 'image/jpeg' });

describe('client image thumbnail formats', () => {
  it.each(['image/webp', 'image/png'] as const)(
    'uses the actual %s output in the note upload manifest',
    async (contentType) => {
      const encoded = new File(['preview'], 'preview', { type: contentType });
      vi.mocked(imageCompression).mockResolvedValue(encoded);
      const file = original();
      const compressed = await generateImageThumbnail(file);
      expect(compressed).toBe(encoded);
      expect(
        noteFileManifest({ file, clientId: 'client', compressed, poster: null }).compressed
      ).toEqual({ contentType, size: encoded.size });
      expect(imageCompression).toHaveBeenCalledTimes(1);
    }
  );

  it('requests PNG if a browser does not return a supported thumbnail encoding', async () => {
    const png = new File(['png'], 'preview.png', { type: 'image/png' });
    vi.mocked(imageCompression).mockResolvedValueOnce(original()).mockResolvedValueOnce(png);
    const file = original();
    expect(await generateImageThumbnail(file)).toBe(png);
    expect(imageCompression).toHaveBeenLastCalledWith(
      file,
      expect.objectContaining({
        fileType: 'image/png',
        maxWidthOrHeight: 2560,
      })
    );
  });

  it('rejects unsupported output instead of labeling JPEG bytes as PNG or WebP', async () => {
    vi.mocked(imageCompression).mockResolvedValue(original());
    await expect(generateImageThumbnail(original())).rejects.toThrow();
  });

  it('does not flatten animated GIFs into image thumbnails', async () => {
    const gif = new File(['gif'], 'animation.gif', { type: 'image/gif' });
    expect(await generateImageThumbnail(gif)).toBeNull();
    expect(imageCompression).not.toHaveBeenCalled();
  });
});
