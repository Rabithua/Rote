const DECIMAL_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function parseByteCount(value: string | null): bigint | null {
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  return BigInt(value);
}

export function formatBytes(value: string | null): string | null {
  const bytes = parseByteCount(value);
  if (bytes === null) return null;
  let unitIndex = 0;
  let divisor = BigInt(1);
  while (unitIndex < DECIMAL_UNITS.length - 1 && bytes >= divisor * BigInt(1000)) {
    divisor *= BigInt(1000);
    unitIndex += 1;
  }
  if (unitIndex === 0) return `${bytes.toString()} ${DECIMAL_UNITS[unitIndex]}`;
  const tenths = (bytes * BigInt(10)) / divisor;
  const whole = tenths / BigInt(10);
  const decimal = tenths % BigInt(10);
  return `${whole.toString()}${decimal === BigInt(0) ? '' : `.${decimal.toString()}`} ${DECIMAL_UNITS[unitIndex]}`;
}

export function storageProgress(
  used: string | null,
  reserved: string | null,
  limit: string | null
) {
  const usedBytes = parseByteCount(used) ?? BigInt(0);
  const reservedBytes = parseByteCount(reserved) ?? BigInt(0);
  const limitBytes = parseByteCount(limit);
  if (limitBytes === null || limitBytes === BigInt(0)) return 0;
  const hundredths = ((usedBytes + reservedBytes) * BigInt(10_000)) / limitBytes;
  return Math.min(100, Number(hundredths) / 100);
}
