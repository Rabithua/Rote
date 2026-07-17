import decodeHeic from 'heic-decode';
import jpeg from 'jpeg-js';

export const MAX_LIVE_PHOTO_COVER_DIMENSION = 8192;
export const MAX_LIVE_PHOTO_COVER_PIXELS = 25_000_000;

export type ImageDimensions = {
  height: number;
  width: number;
};

function assertDimensions({ height, width }: ImageDimensions): void {
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_LIVE_PHOTO_COVER_DIMENSION ||
    height > MAX_LIVE_PHOTO_COVER_DIMENSION ||
    width * height > MAX_LIVE_PHOTO_COVER_PIXELS
  ) {
    throw new Error(
      `Live Photo cover dimensions exceed limit: ${width}x${height}, maxPixels=${MAX_LIVE_PHOTO_COVER_PIXELS}`
    );
  }
}

export function getHeifImageDimensions(input: Uint8Array): ImageDimensions[] {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const dimensions: ImageDimensions[] = [];

  for (let typeOffset = 4; typeOffset + 16 <= input.byteLength; typeOffset++) {
    if (
      input[typeOffset] !== 0x69 ||
      input[typeOffset + 1] !== 0x73 ||
      input[typeOffset + 2] !== 0x70 ||
      input[typeOffset + 3] !== 0x65
    ) {
      continue;
    }

    const boxStart = typeOffset - 4;
    const boxSize = view.getUint32(boxStart);
    if (boxSize < 20 || boxStart + boxSize > input.byteLength) continue;

    const width = view.getUint32(typeOffset + 8);
    const height = view.getUint32(typeOffset + 12);
    if (width > 0 && height > 0) dimensions.push({ height, width });
  }

  return dimensions;
}

export function assertHeifImageDimensions(input: Uint8Array): void {
  const dimensionsList = getHeifImageDimensions(input);
  if (dimensionsList.length === 0) {
    throw new Error('HEIC dimensions could not be read before decoding');
  }
  for (const dimensions of dimensionsList) {
    assertDimensions(dimensions);
  }
}

export async function encodeHeicToJpegInProcess(input: Uint8Array): Promise<Uint8Array> {
  const decoded = await decodeHeic({ buffer: input });
  if (!decoded.width || !decoded.height || decoded.data.byteLength === 0) {
    throw new Error('HEIC decoder returned an empty image');
  }
  assertDimensions(decoded);

  return new Uint8Array(
    jpeg.encode(
      {
        width: decoded.width,
        height: decoded.height,
        data: Buffer.from(decoded.data),
      },
      85
    ).data
  );
}
