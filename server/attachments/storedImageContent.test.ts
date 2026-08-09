import { describe, expect, it } from 'bun:test';
import { detectStoredImageContentType } from './storedImageContent';

function ftyp(majorBrand: string, compatibleBrands: string[] = []): Uint8Array {
  const bytes = new Uint8Array(16 + compatibleBrands.length * 4);
  new DataView(bytes.buffer).setUint32(0, bytes.byteLength);
  bytes.set(Buffer.from('ftyp'), 4);
  bytes.set(Buffer.from(majorBrand), 8);
  compatibleBrands.forEach((brand, index) => bytes.set(Buffer.from(brand), 16 + index * 4));
  return bytes;
}

describe('stored image content detection', () => {
  it('detects JPEG signatures', () => {
    expect(detectStoredImageContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1]))).toBe(
      'image/jpeg'
    );
  });

  it('detects HEIC from the major brand', () => {
    expect(detectStoredImageContentType(ftyp('heic'))).toBe('image/heic');
  });

  it('detects HEIC from a compatible brand', () => {
    expect(detectStoredImageContentType(ftyp('mif1', ['miaf', 'heic']))).toBe('image/heic');
  });

  it('does not classify unrelated ISO media as HEIC', () => {
    expect(detectStoredImageContentType(ftyp('qt  ', ['mp42']))).toBeNull();
  });
});
