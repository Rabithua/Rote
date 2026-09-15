import { describe, expect, it } from 'bun:test';
import { AttachmentPresignZod } from '../utils/zod';

const original = {
  filename: 'IMG_0001.HEIC',
  contentType: 'image/heic',
  size: 1024,
  mediaKind: 'image',
};

describe('presign request contract used by HTTP and MCP entry points', () => {
  it.each(['image/png', 'image/webp', 'image/jpeg'])(
    'accepts a legacy client declaration for %s',
    (contentType) => {
      const body = { files: [{ ...original, compressedContentType: contentType }] };
      expect(AttachmentPresignZod.parse(body)).toEqual(body);
    }
  );

  it.each(['image/png', 'image/webp', 'image/jpeg'])(
    'accepts a direct upload manifest for %s',
    (contentType) => {
      const body = {
        browserDirectUpload: true,
        files: [{ ...original, compressed: { contentType, size: 256 } }],
      };
      expect(AttachmentPresignZod.parse(body)).toEqual(body);
    }
  );

  it.each(['image/heic', 'application/octet-stream'])(
    'rejects unsupported thumbnail output %s in both request shapes',
    (contentType) => {
      expect(
        AttachmentPresignZod.safeParse({
          files: [{ ...original, compressedContentType: contentType }],
        }).success
      ).toBe(false);
      expect(
        AttachmentPresignZod.safeParse({
          browserDirectUpload: true,
          files: [{ ...original, compressed: { contentType, size: 256 } }],
        }).success
      ).toBe(false);
    }
  );
});
