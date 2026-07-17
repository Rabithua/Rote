import { describe, expect, it } from 'bun:test';
import jpeg from 'jpeg-js';
import {
  assertLivePhotoFinalizeBatch,
  encodeHeicToJpeg,
  ensureLivePhotoCover,
  getLivePhotoCoverKey,
  isJpeg,
  LIVE_PHOTO_COVER_CONTENT_TYPE,
  MAX_LIVE_PHOTOS_PER_FINALIZE,
  type LivePhotoCoverStorage,
} from './livePhotoCover';
import { assertHeifImageDimensions, MAX_LIVE_PHOTO_COVER_DIMENSION } from './livePhotoCoverCodec';

const TINY_HEIC_BASE64 =
  'AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYxAAAC3G1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAADnBpdG0AAAAAAAEAAABNaWluZgAAAAAAAwAAABVpbmZlAgAAAAABAABodmMxAAAAABVpbmZlAgAAAQACAABodmMxAAAAABVpbmZlAgAAAQADAABFeGlmAAAAAChpcmVmAAAAAAAAAA5hdXhsAAIAAQABAAAADmNkc2MAAwABAAEAAAHOaXBycAAAAaNpcGNvAAAAE2NvbHJuY2x4AAIAAgAGgAAAAAxjbGxpAMsAQAAAABRpc3BlAAAAAAAAAAgAAAAGAAAAKGNsYXAAAAAIAAAAAQAAAAUAAAABAAAAAAAAAAH/wAAAAIAAAAAAAAlpcm90AAAAABBwaXhpAAAAAAMICAgAAAAOcGl4aQAAAAABCAAAADdhdXhDAAAAAHVybjptcGVnOmhldmM6MjAxNTphdXhpZDoxAAAAAAwAAAAITgGlBAAB/kAAAABxaHZjQwEDcAAAALAAAAAAAB7wAPz9+PgAAAsDoAABABdAAQwB//8DcAAAAwCwAAADAAADAB5wJKEAAQAjQgEBA3AAAAMAsAAAAwAAAwAeoBQgQcCbD2Ie5FlU3AgIGAKiAAEACUQBwGFyyEBTJAAAAHFodmNDAQQIAAAAv8gAAAAAHvAA/Pz4+AAACwOgAAEAF0ABDAH//wQIAAADAL/IAAADAAAeFwJAoQABACNCAQEECAAAAwC/yAAAAwAAHsBQgQcBMwd4gXuRZVNwICAgCKIAAQAJRAHAYdLIQFMkAAAAI2lwbWEAAAAAAAAAAgABB4ECAwaJhIUAAgYDB4iKhIUAAAA6aWxvYwAAAABEAAADAAEAAAABAAADhgAAAGEAAgAAAAEAAAPnAAAAWQADAAAAAQAAAwQAAACCAAAAAW1kYXQAAAAAAAABTAAAAAZFeGlmAABNTQAqAAAACAAEARoABQAAAAEAAAA+ARsABQAAAAEAAABGASgAAwAAAAEAAgAAh2kABAAAAAEAAABOAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAACKADAAQAAAABAAAABQAAAAAAAABdKAGvo8iADfpG7zG+1YAuPcvygccUK1srVGDzGMCjSLvSD6XdEBkPL9aiFwNXP1hf7hmoYAkWHk0dYz01nQSqKXe+xuYAPF+jfcMDW4lHQB5RBcfvTj+CFarRwEDAAAAAVSgBr0eHNdCt6no8BXaeEM6qgK2JQOaTFfNfW3BN7h1cmbsm8ZOUZeWYa1F+XRgFTP3HPso5rkhVNT32x/jPBeJPjXf/eLDv6CBANYB9t8P7cgBNQXA=';

function withHeicDimensions(width: number, height: number): Uint8Array {
  const bytes = Buffer.from(TINY_HEIC_BASE64, 'base64');
  const ispeOffset = bytes.indexOf(Buffer.from('ispe'));
  if (ispeOffset < 0) throw new Error('HEIC fixture has no ispe box');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(ispeOffset + 8, width);
  view.setUint32(ispeOffset + 12, height);
  return bytes;
}

describe('Live Photo cover generation', () => {
  it('encodes HEIC bytes as a real JPEG', async () => {
    const output = await encodeHeicToJpeg(Buffer.from(TINY_HEIC_BASE64, 'base64'));
    const decoded = jpeg.decode(Buffer.from(output), { useTArray: true });

    expect(isJpeg(output)).toBe(true);
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(5);
  });

  it('rejects oversized HEIC dimensions before decoding', () => {
    expect(() =>
      assertHeifImageDimensions(withHeicDimensions(MAX_LIVE_PHOTO_COVER_DIMENSION + 1, 1))
    ).toThrow('dimensions exceed limit');
  });

  it('limits the number of Live Photo cover jobs accepted by one finalize call', () => {
    expect(() =>
      assertLivePhotoFinalizeBatch(
        Array.from({ length: MAX_LIVE_PHOTOS_PER_FINALIZE + 1 }, () => ({
          mediaKind: 'livePhoto',
        }))
      )
    ).toThrow(`Maximum ${MAX_LIVE_PHOTOS_PER_FINALIZE} Live Photos`);
  });

  it('uses a deterministic .jpg key and reuses a valid existing cover', async () => {
    const originalKey = 'users/user-1/uploads/11111111-1111-4111-8111-111111111111.heic';
    const outputKey = getLivePhotoCoverKey(originalKey);
    const objects = new Map<string, { bytes: Uint8Array; contentType: string }>([
      [
        originalKey,
        {
          bytes: Buffer.from(TINY_HEIC_BASE64, 'base64'),
          contentType: 'image/heic',
        },
      ],
    ]);
    let writes = 0;
    const storage: LivePhotoCoverStorage = {
      getBytes: async (key) => {
        const value = objects.get(key);
        if (!value) throw new Error(`missing object: ${key}`);
        return value.bytes;
      },
      getInfo: async (key) => {
        const value = objects.get(key);
        return value
          ? { contentLength: value.bytes.byteLength, contentType: value.contentType }
          : null;
      },
      putBytes: async (key, bytes, contentType) => {
        writes++;
        objects.set(key, { bytes, contentType });
      },
    };

    const generated = await ensureLivePhotoCover(originalKey, { storage });
    const reused = await ensureLivePhotoCover(originalKey, { storage });

    expect(outputKey).toBe('users/user-1/compressed/11111111-1111-4111-8111-111111111111.jpg');
    expect(generated.status).toBe('generated');
    expect(reused.status).toBe('reused');
    expect(reused.key).toBe(generated.key);
    expect(writes).toBe(1);
    expect(objects.get(outputKey)?.contentType).toBe(LIVE_PHOTO_COVER_CONTENT_TYPE);
    expect(isJpeg(objects.get(outputKey)!.bytes)).toBe(true);
  });
});
