const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isSourceKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const separatorIndex = value.indexOf(':');
  if (separatorIndex < 0 || value.indexOf(':', separatorIndex + 1) >= 0) return false;
  const sourceType = value.slice(0, separatorIndex);
  const sourceId = value.slice(separatorIndex + 1);
  return (sourceType === 'rote' || sourceType === 'article') && isUuid(sourceId);
}

export function sanitizeExcludeIds(ids: unknown): string[] | undefined {
  if (!Array.isArray(ids)) return undefined;
  const sanitized = Array.from(
    new Set(ids.filter(isSourceKey).map((id) => id.toLowerCase()))
  ).slice(0, 500);
  return sanitized.length > 0 ? sanitized : undefined;
}
