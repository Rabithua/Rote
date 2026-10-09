import type { AiUsageRecord } from './types';

export async function saveAiUsage(record: AiUsageRecord): Promise<void> {
  const [{ default: db }, { aiTokenUsageLogs }] = await Promise.all([
    import('../utils/drizzle'),
    import('../drizzle/schema'),
  ]);
  await db
    .insert(aiTokenUsageLogs)
    .values(record)
    .onConflictDoUpdate({ target: aiTokenUsageLogs.requestId, set: record });
}
