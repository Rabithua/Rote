import type { HonoContext, HonoVariables } from '../../../types/hono';
import { z } from 'zod';
import openKeyErrors from './errorCodes.json';

const UuidZod = z.string().uuid();

export type OpenKey = NonNullable<HonoVariables['openKey']>;

export function requireOpenKey(c: HonoContext): OpenKey {
  const openKey = c.get('openKey');
  if (!openKey) throw new Error('Need openkey!');
  return openKey;
}

export function requireOpenKeyPerm(...permissions: string[]) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const openKey = requireOpenKey(c);
    if (
      permissions.length > 0 &&
      !permissions.some((permission) => openKey.permissions.includes(permission))
    ) {
      throw new Error('API key permission does not match');
    }
    await next();
  };
}

export function assertUuid(value: unknown, message: string): string {
  if (typeof value !== 'string' || !UuidZod.safeParse(value).success) {
    throw new Error(message);
  }
  return value;
}

export function parseOptionalInteger(
  value: string | undefined,
  message: string,
  minimum: number
): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(message);
  return parsed;
}

export function parseLegacyBoolean(
  value: string | undefined,
  parameter: string
): boolean | undefined {
  if (value === undefined) return undefined;
  const parsed = z
    .enum(['true', 'false', '1', '0'], {
      error: openKeyErrors.invalidBooleanParameterPrefix + parameter,
    })
    .parse(value);
  return parsed === 'true' || parsed === '1';
}

export function processTags(values: readonly string[]): string[] {
  const tags = values.map((value) => value.trim()).filter((value) => value.length > 0);
  if (tags.length > 20) throw new Error('Maximum 20 tags allowed');
  if (tags.some((tag) => tag.length > 50)) {
    throw new Error('Single tag cannot exceed 50 characters');
  }
  return tags;
}

export function markLegacyNoteCreate(c: HonoContext) {
  c.header('Deprecation', 'true');
  c.header('Link', '</v2/api/openkey/notes>; rel="successor-version"');
}

export type NoteFilter = Record<string, string | { hasEvery: string[] }>;

export function buildNoteFilter(
  query: Record<string, string>,
  tags: string[],
  excludedKeys: readonly string[]
): NoteFilter {
  const excluded = new Set([...excludedKeys, 'openkey', 'tag', 'tag[]']);
  const filter: NoteFilter = {};
  if (tags.length > 0) filter.tags = { hasEvery: tags };
  for (const [key, value] of Object.entries(query)) {
    if (!excluded.has(key)) filter[key] = value;
  }
  return filter;
}
