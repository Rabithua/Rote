// Presentation geometry survives recycled rows independently of the browser's image cache.
const settledRatios = new Map<string, number>();
const maximumEntries = 1000;

export function imageRatio(width?: number, height?: number): number | undefined {
  return width && height && Number.isFinite(width / height) && width > 0 && height > 0
    ? width / height
    : undefined;
}

export function getSettledImageRatio(key: string) {
  return settledRatios.get(key);
}

export function settleImageRatio(key: string, ratio: number) {
  settledRatios.delete(key);
  settledRatios.set(key, ratio);
  if (settledRatios.size > maximumEntries) {
    settledRatios.delete(settledRatios.keys().next().value!);
  }
}
