import { expect, it } from 'bun:test';
import type { SecurityConfig } from '../types/config';
import type { createAdminSettingsFixture } from '../settings/integrationFixture';

export function registerSettingsPersistenceCases(
  getFixture: () => Awaited<ReturnType<typeof createAdminSettingsFixture>>
) {
  it('rolls back a multi-group operation and lets later configuration changes proceed', async () => {
    const { mutateStoredConfigs } = await import('../settings/configStore');
    const { db, schema, operators, config, storedSecurity } = getFixture();
    const before = await db.select().from(schema.settings);
    await expect(
      mutateStoredConfigs([
        {
          group: 'notification',
          update: () => ({ vapidPublicKey: 'discarded', vapidPrivateKey: 'discarded' }),
        },
        {
          group: 'security',
          update: () => {
            throw new Error('reject transaction');
          },
        },
      ])
    ).rejects.toThrow('reject transaction');
    const after = await db.select().from(schema.settings);
    expect(after).toEqual(before);
    await expect(
      config.updateConfig<SecurityConfig>('security', () => {
        throw new Error('reject settings validation');
      })
    ).rejects.toThrow('reject settings validation');
    await config.updateConfig<SecurityConfig>('security', (existing) => ({
      ...existing!,
      jwtAccessExpiry: '5h',
    }));
    expect((await storedSecurity()).jwtAccessExpiry).toBe('5h');
    const [row] = await db
      .select()
      .from(schema.settings)
      .where(operators.eq(schema.settings.group, 'security'));
    expect(config.getGlobalConfig<SecurityConfig>('security')?.jwtSecret).toBe(
      (row.config as SecurityConfig).jwtSecret
    );
  });

  it('locks against independent database writers and patches their latest committed configuration', async () => {
    const { mutateStoredConfigs } = await import('../settings/configStore');
    const { db, operators, config, storedSecurity } = getFixture();
    let entered!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const releaseFirst = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = mutateStoredConfigs([
      {
        group: 'security',
        update: async (existing) => {
          entered();
          await releaseFirst;
          return { ...(existing as SecurityConfig), jwtAccessExpiry: '6h' };
        },
      },
    ]);
    await firstEntered;
    let secondRead = false;
    const second = mutateStoredConfigs([
      {
        group: 'security',
        update: (existing) => {
          secondRead = true;
          return { ...(existing as SecurityConfig), requireCertifiedUserForExplore: false };
        },
      },
    ]);
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100 && !blocked; attempt += 1) {
        const rows = await db.execute(operators.sql`
          SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE '%settings%' LIMIT 1
        `);
        blocked = rows.length > 0;
      }
      expect(blocked).toBe(true);
      expect(secondRead).toBe(false);
    } finally {
      release();
      await Promise.all([first, second]);
    }
    const saved = await storedSecurity();
    expect(saved.jwtAccessExpiry).toBe('6h');
    expect(saved.requireCertifiedUserForExplore).toBe(false);
    await config.refreshConfigCache();
    expect(config.getGlobalConfig<SecurityConfig>('security')?.jwtAccessExpiry).toBe('6h');
  });
}
