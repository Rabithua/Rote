import type { HonoContext } from '../types/hono';
import { createResponse, isValidUUID } from '../utils/main';
import mcpErrors from './errorCodes.json';
import type { McpToolResult } from './types';

export function requireAuth(c: HonoContext) {
  const auth = c.get('mcpAuth');
  if (!auth) {
    throw new Error(mcpErrors.authRequired);
  }
  return auth;
}

export function assertUuid(id: unknown, label: string): string {
  if (typeof id !== 'string' || !isValidUUID(id)) {
    throw new Error(mcpErrors.invalidUuidPrefix + label);
  }
  return id;
}

export function parseOptionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(mcpErrors.nonNegativeIntegerRequiredPrefix + label);
  }
  return parsed;
}

export function parseOptionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(mcpErrors.positiveLimitRequired);
  }
  return parsed;
}

export function processTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    const processed = tags
      .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag) => tag.trim());
    if (processed.length > 20) {
      throw new Error(mcpErrors.tagCountExceeded);
    }
    for (const tag of processed) {
      if (tag.length > 50) {
        throw new Error(mcpErrors.tagLengthExceeded);
      }
    }
    return processed;
  }

  if (typeof tags === 'string' && tags.trim().length > 0) {
    const tag = tags.trim();
    if (tag.length > 50) {
      throw new Error(mcpErrors.tagLengthExceeded);
    }
    return [tag];
  }

  return [];
}

export function buildNoteFilter(args: Record<string, any>) {
  const filter: any = {};
  const tags = processTags(args.tags ?? args.tag);
  if (tags.length > 0) {
    filter.tags = { hasEvery: tags };
  }

  for (const key of ['state', 'pin']) {
    if (args[key] !== undefined) {
      filter[key] = args[key];
    }
  }

  return filter;
}

export function parseArchived(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(mcpErrors.archivedBooleanRequired);
}

export function validateDateRange(startDate: unknown, endDate: unknown) {
  if (typeof startDate !== 'string' || typeof endDate !== 'string') {
    throw new Error(mcpErrors.dateRangeRequired);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error(mcpErrors.invalidDateFormat);
  }

  for (const [label, value] of [
    ['start_date', startDate],
    ['end_date', endDate],
  ] as const) {
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error(mcpErrors.invalidCalendarDatePrefix + label);
    }
  }
}

export function formatToolOutput(data: any): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(createResponse(data), null, 2) }],
  };
}
