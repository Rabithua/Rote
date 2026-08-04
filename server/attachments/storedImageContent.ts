import { getObjectPrefix } from '../utils/r2';

export const STORED_IMAGE_SIGNATURE_BYTES = 64;

const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

export type DetectedStoredImageContentType = 'image/heic' | 'image/jpeg';

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length)).toLowerCase();
}

export function detectStoredImageContentType(
  bytes: Uint8Array
): DetectedStoredImageContentType | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (bytes.byteLength < 12 || ascii(bytes, 4, 4) !== 'ftyp') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredBoxSize = view.getUint32(0);
  const boxEnd =
    declaredBoxSize >= 16 ? Math.min(declaredBoxSize, bytes.byteLength) : bytes.byteLength;
  const brands = [ascii(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }

  return brands.some((brand) => HEIF_BRANDS.has(brand)) ? 'image/heic' : null;
}

export async function detectStoredImageContentTypeByKey(
  key: string,
  readPrefix: typeof getObjectPrefix = getObjectPrefix
): Promise<DetectedStoredImageContentType | null> {
  const bytes = await readPrefix(key, STORED_IMAGE_SIGNATURE_BYTES);
  return detectStoredImageContentType(bytes);
}
