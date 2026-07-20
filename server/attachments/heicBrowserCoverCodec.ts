import decodeHeic from 'heic-decode';
import jpeg from 'jpeg-js';

export const MAX_HEIC_SOURCE_DIMENSION = 8192;
export const MAX_HEIC_SOURCE_PIXELS = 25_000_000;
export const BROWSER_COVER_MAX_DIMENSION = 2560;
export const BROWSER_COVER_JPEG_QUALITY = 75;

export type ImageDimensions = {
  height: number;
  width: number;
};

function assertDimensions({ height, width }: ImageDimensions): void {
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_HEIC_SOURCE_DIMENSION ||
    height > MAX_HEIC_SOURCE_DIMENSION ||
    width * height > MAX_HEIC_SOURCE_PIXELS
  ) {
    throw new Error(
      `HEIC source dimensions exceed limit: ${width}x${height}, maxPixels=${MAX_HEIC_SOURCE_PIXELS}`
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

export function getBrowserCoverDimensions({ height, width }: ImageDimensions): ImageDimensions {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= BROWSER_COVER_MAX_DIMENSION) return { height, width };

  const scale = BROWSER_COVER_MAX_DIMENSION / longestEdge;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function resizeRgba(
  input: ArrayLike<number>,
  source: ImageDimensions,
  target: ImageDimensions
): Uint8Array {
  if (source.width === target.width && source.height === target.height) {
    return Uint8Array.from(input);
  }

  const output = new Uint8Array(target.width * target.height * 4);
  const xRatio = source.width / target.width;
  const yRatio = source.height / target.height;

  for (let targetY = 0; targetY < target.height; targetY++) {
    const sourceY = Math.max(0, (targetY + 0.5) * yRatio - 0.5);
    const sourceY0 = Math.min(source.height - 1, Math.floor(sourceY));
    const sourceY1 = Math.min(source.height - 1, sourceY0 + 1);
    const yWeight = sourceY - sourceY0;
    for (let targetX = 0; targetX < target.width; targetX++) {
      const sourceX = Math.max(0, (targetX + 0.5) * xRatio - 0.5);
      const sourceX0 = Math.min(source.width - 1, Math.floor(sourceX));
      const sourceX1 = Math.min(source.width - 1, sourceX0 + 1);
      const xWeight = sourceX - sourceX0;
      const topLeftOffset = (sourceY0 * source.width + sourceX0) * 4;
      const topRightOffset = (sourceY0 * source.width + sourceX1) * 4;
      const bottomLeftOffset = (sourceY1 * source.width + sourceX0) * 4;
      const bottomRightOffset = (sourceY1 * source.width + sourceX1) * 4;
      const targetOffset = (targetY * target.width + targetX) * 4;

      for (let channel = 0; channel < 4; channel++) {
        const top =
          input[topLeftOffset + channel] * (1 - xWeight) +
          input[topRightOffset + channel] * xWeight;
        const bottom =
          input[bottomLeftOffset + channel] * (1 - xWeight) +
          input[bottomRightOffset + channel] * xWeight;
        output[targetOffset + channel] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }

  return output;
}

export async function encodeHeicToJpegInProcess(input: Uint8Array): Promise<Uint8Array> {
  const decoded = await decodeHeic({ buffer: input });
  if (!decoded.width || !decoded.height || decoded.data.byteLength === 0) {
    throw new Error('HEIC decoder returned an empty image');
  }
  assertDimensions(decoded);
  const dimensions = getBrowserCoverDimensions(decoded);
  const data = resizeRgba(decoded.data, decoded, dimensions);

  return new Uint8Array(
    jpeg.encode(
      {
        width: dimensions.width,
        height: dimensions.height,
        data: Buffer.from(data),
      },
      BROWSER_COVER_JPEG_QUALITY
    ).data
  );
}
