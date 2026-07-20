import { parseFragment } from 'parse5';

export const CUSTOM_HEAD_SCRIPTS_MAX_BYTES = 64 * 1024;

export function normalizeCustomHeadScripts(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('Custom head scripts must be a string');
  }

  if (new TextEncoder().encode(value).byteLength > CUSTOM_HEAD_SCRIPTS_MAX_BYTES) {
    throw new Error('Custom head scripts must not exceed 64 KiB');
  }

  const parseErrors: unknown[] = [];
  const fragment = parseFragment(value, {
    onParseError: (error) => parseErrors.push(error),
  });

  if (parseErrors.length > 0) {
    throw new Error('Custom head scripts contain malformed HTML');
  }

  for (const node of fragment.childNodes) {
    if (node.nodeName === '#comment') continue;
    if (node.nodeName === '#text' && 'value' in node && node.value.trim() === '') continue;
    if (node.nodeName === 'script') continue;
    throw new Error('Custom head scripts may only contain <script> tags');
  }

  return value;
}

export function resolveCustomHeadScriptsUpdate(
  existingValue: unknown,
  incomingValue: unknown,
  isSuperAdmin: boolean
): string | undefined {
  const existingScripts = normalizeCustomHeadScripts(existingValue);
  const incomingScripts = normalizeCustomHeadScripts(incomingValue);

  if (existingScripts !== incomingScripts && !isSuperAdmin) {
    throw new Error('Only super admin can modify custom head scripts');
  }

  return incomingScripts;
}
