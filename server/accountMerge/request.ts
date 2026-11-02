import { z } from 'zod';

const sourceIdSchema = z.uuid();
const providerIdSchema = z.string().min(1).max(255);

export function parseOAuthMergeRequest(
  value: unknown,
  provider: string
): { sourceUserId: string; providerId: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const source = sourceIdSchema.safeParse(body.existingUserId);
  const subject = providerIdSchema.safeParse(body[`${provider}UserId`]);
  if (!source.success || !subject.success) return null;
  // Retain the legacy body shape. Client-declared usernames and other metadata
  // do not participate in either authorization or transferred binding data.
  return { sourceUserId: source.data, providerId: subject.data };
}
