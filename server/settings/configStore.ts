import { eq } from 'drizzle-orm';
import { settings } from '../drizzle/schema';
import type { ConfigData, ConfigGroup, ConfigUpdateOptions } from '../types/config';
import db from '../utils/drizzle';

export interface ConfigMutation {
  group: ConfigGroup;
  update: (existing: ConfigData | null) => ConfigData | Promise<ConfigData>;
  options?: ConfigUpdateOptions;
}

export async function mutateStoredConfigs(mutations: ConfigMutation[]) {
  return db.transaction(async (tx) => {
    const changes = [];
    // A stable lock order also covers operations that change several groups together.
    for (const mutation of [...mutations].sort((a, b) => a.group.localeCompare(b.group))) {
      const { group, options } = mutation;
      // Creating the row first makes first-time initialization participate in row locking too.
      await tx.insert(settings).values({ group, config: {} }).onConflictDoNothing();
      const [existing] = await tx
        .select()
        .from(settings)
        .where(eq(settings.group, group))
        .for('update');
      const previous = existing.config as ConfigData;
      const config = await mutation.update(previous);
      await tx
        .update(settings)
        .set({
          config,
          isRequired: options?.isRequired ?? existing.isRequired,
          isSystem: options?.isSystem ?? existing.isSystem,
          isInitialized: options?.isInitialized ?? true,
          updatedAt: new Date(),
        })
        .where(eq(settings.group, group));
      changes.push({ group, config, previous });
    }
    return changes;
  });
}
