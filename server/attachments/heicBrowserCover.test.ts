import { describe, expect, it } from 'bun:test';
import jpeg from 'jpeg-js';
import {
  encodeHeicToJpeg,
  ensureHeicBrowserCover,
  getHeicBrowserCoverKey,
  HEIC_BROWSER_COVER_CONTENT_TYPE,
  isJpeg,
  type HeicBrowserCoverStorage,
} from './heicBrowserCover';
import {
  assertHeifImageDimensions,
  BROWSER_COVER_MAX_DIMENSION,
  getBrowserCoverDimensions,
  MAX_HEIC_SOURCE_DIMENSION,
} from './heicBrowserCoverCodec';
import { assertLivePhotoFinalizeBatch, MAX_LIVE_PHOTOS_PER_FINALIZE } from './livePhotoFinalize';

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

describe('HEIC browser cover generation', () => {
  it('scales browser covers down without changing their aspect ratio', () => {
    expect(getBrowserCoverDimensions({ width: 4032, height: 3024 })).toEqual({
      width: BROWSER_COVER_MAX_DIMENSION,
      height: 1920,
    });
    expect(getBrowserCoverDimensions({ width: 1200, height: 900 })).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it('encodes HEIC bytes as a real JPEG', async () => {
    const output = await encodeHeicToJpeg(Buffer.from(TINY_HEIC_BASE64, 'base64'));
    const decoded = jpeg.decode(Buffer.from(output), { useTArray: true });

    expect(isJpeg(output)).toBe(true);
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(5);
  });

  it('rejects oversized HEIC dimensions before decoding', () => {
    expect(() =>
      assertHeifImageDimensions(withHeicDimensions(MAX_HEIC_SOURCE_DIMENSION + 1, 1))
    ).toThrow('dimensions exceed limit');
  });

  it('limits the number of Live Photos accepted by one finalize call', () => {
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
    const outputKey = getHeicBrowserCoverKey(originalKey);
    const legacyOutputKey = 'users/user-1/compressed/11111111-1111-4111-8111-111111111111.jpg';
    const legacyCover = jpeg.encode({ data: Buffer.alloc(4), height: 1, width: 1 }, 85).data;
    const objects = new Map<string, { bytes: Uint8Array; contentType: string }>([
      [
        originalKey,
        {
          bytes: Buffer.from(TINY_HEIC_BASE64, 'base64'),
          contentType: 'image/heic',
        },
      ],
      [legacyOutputKey, { bytes: legacyCover, contentType: 'image/jpeg' }],
    ]);
    let writes = 0;
    const storage: HeicBrowserCoverStorage = {
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

    const generated = await ensureHeicBrowserCover(originalKey, { storage });
    const reused = await ensureHeicBrowserCover(originalKey, { storage });

    expect(outputKey).toBe('users/user-1/compressed/11111111-1111-4111-8111-111111111111.v2.jpg');
    expect(generated.status).toBe('generated');
    expect(reused.status).toBe('reused');
    expect(reused.key).toBe(generated.key);
    expect(writes).toBe(1);
    expect(objects.get(outputKey)?.contentType).toBe(HEIC_BROWSER_COVER_CONTENT_TYPE);
    expect(isJpeg(objects.get(outputKey)!.bytes)).toBe(true);
    expect(objects.get(legacyOutputKey)?.bytes).toBe(legacyCover);
  });
});
