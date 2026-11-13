import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

const databaseUrl = process.env.GIFT_TEST_DATABASE_URL;
const databaseDescribe = databaseUrl ? describe : describe.skip;

databaseDescribe('gift service integration', () => {
  let database: typeof import('../utils/drizzle').default;
  let schema: typeof import('../drizzle/schema');
  let service: typeof import('./service');
  const adminId = randomUUID();
  const usernames = ['gift_alice', 'gift_bob', 'gift_carol'];
  const userIds: string[] = [];
  // Teardown stays scoped to campaigns this suite created — the test database
  // may be shared and must not lose unrelated gift data. Unique per-run names
  // keep a stale same-named campaign from being adopted (and later deleted).
  const runSuffix = randomUUID().slice(0, 8);
  const createdCampaignIds: string[] = [];
  let primaryCampaignId: string | null = null;

  const futureDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const importTestCodes = async (
    input: Parameters<typeof service.importCodes>[0]
  ): ReturnType<typeof service.importCodes> => {
    const result = await service.importCodes({
      ...input,
      name: `${input.name}-${runSuffix}`,
    });
    createdCampaignIds.push(result.campaignId);
    return result;
  };

  beforeAll(async () => {
    process.env.POSTGRESQL_URL = databaseUrl;
    ({ default: database } = await import('../utils/drizzle'));
    schema = await import('../drizzle/schema');
    service = await import('./service');
    const inserted = await database
      .insert(schema.users)
      .values(
        usernames.map((username, index) => ({
          id: randomUUID(),
          email: `gift-${index}-${randomUUID()}@example.test`,
          username,
        }))
      )
      .returning({ id: schema.users.id });
    userIds.push(...inserted.map((row) => row.id));
    await database.insert(schema.users).values({
      id: adminId,
      email: `gift-admin-${randomUUID()}@example.test`,
      username: 'gift_admin',
      role: 'super_admin',
    });
  });

  afterAll(async () => {
    const { inArray } = await import('drizzle-orm');
    if (createdCampaignIds.length > 0) {
      await database
        .delete(schema.giftCodes)
        .where(inArray(schema.giftCodes.campaignId, createdCampaignIds));
      await database
        .delete(schema.giftCampaigns)
        .where(inArray(schema.giftCampaigns.id, createdCampaignIds));
    }
    await database.delete(schema.users).where(inArray(schema.users.id, [...userIds, adminId]));
  });

  it('imports codes with dedupe and audit description', async () => {
    const first = await importTestCodes({
      name: 'push-thanks-2026-11',
      title: 'A thank-you gift',
      description: 'Thanks for keeping notifications on.',
      createdBy: adminId,
      codes: [
        { code: 'ROTE-AAA1', expiresAt: futureDate(30) },
        { code: 'ROTE-BBB2', expiresAt: futureDate(30) },
        { code: 'ROTE-CCC3', expiresAt: futureDate(45) },
      ],
    });
    expect(first.imported).toBe(3);
    expect(first.duplicates).toBe(0);
    expect(first.totalCodes).toBe(3);

    const second = await importTestCodes({
      name: 'push-thanks-2026-11',
      codes: [
        { code: 'ROTE-BBB2', expiresAt: futureDate(30) },
        { code: 'ROTE-DDD4', expiresAt: futureDate(45) },
        { code: 'ROTE-DDD4', expiresAt: futureDate(45) },
      ],
    });
    expect(second.imported).toBe(1);
    expect(second.duplicates).toBe(1);
    expect(second.totalCodes).toBe(4);
    primaryCampaignId = second.campaignId;
  });

  it('rejects expired or malformed imports', async () => {
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: 'ROTE-OLD', expiresAt: new Date(Date.now() - 1000) }],
      })
    ).rejects.toThrow('gift_invalid_request');
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: '', expiresAt: futureDate(1) }],
      })
    ).rejects.toThrow('gift_invalid_request');
  });

  it('allocates by username, reports unknown names, and is idempotent', async () => {
    const result = await service.allocate({
      campaignId: primaryCampaignId!,
      usernames: ['gift_alice', 'gift_bob', 'gift_ghost'],
    });
    expect(result.allocated).toBe(2);
    expect(result.unknownUsernames).toEqual(['gift_ghost']);
    expect(result.alreadyAllocated).toBe(0);

    const rerun = await service.allocate({
      campaignId: primaryCampaignId!,
      usernames: ['gift_alice', 'gift_bob'],
    });
    expect(rerun.allocated).toBe(0);
    expect(rerun.alreadyAllocated).toBe(2);
  });

  it('surfaces the pending gift once, marks shown, then hides it', async () => {
    const aliceId = userIds[0];

    const before = await service.currentGiftForUser(aliceId);
    expect(before).not.toBeNull();
    expect(before?.title).toBe('A thank-you gift');
    expect(before?.description).toBe('Thanks for keeping notifications on.');

    // A different user cannot mark someone else's gift shown.
    expect(await service.markShown(before!.codeId, userIds[1])).toBe('unknown');
    expect(await service.markShown(before!.codeId, aliceId)).toBe('marked');
    expect(await service.markShown(before!.codeId, aliceId)).toBe('already_shown');
    expect(await service.currentGiftForUser(aliceId)).toBeNull();
  });

  it('never returns expired allocations and reports them in the funnel', async () => {
    const carolId = userIds[2];
    const imported = await importTestCodes({
      name: 'short-window',
      codes: [{ code: 'ROTE-SOON', expiresAt: futureDate(1) }],
    });
    await service.allocate({ campaignId: imported.campaignId, userids: [carolId] });
    // Backdate the expiry directly to simulate the clock passing show time.
    await database
      .update(schema.giftCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(
        and(
          eq(schema.giftCodes.campaignId, imported.campaignId),
          eq(schema.giftCodes.code, 'ROTE-SOON')
        )
      );
    expect(await service.currentGiftForUser(carolId)).toBeNull();

    const status = await service.campaignStatus(imported.campaignId);
    expect(status.totals.expired).toBe(1);
    expect(status.totals.allocatedActive).toBe(0);
    expect(status.totals.available).toBe(0);
  });

  it('fails allocation when the unexpired pool is too small', async () => {
    const imported = await importTestCodes({
      name: 'tiny-pool',
      codes: [{ code: 'ROTE-ONE', expiresAt: futureDate(5) }],
    });
    expect(
      service.allocate({
        campaignId: imported.campaignId,
        usernames: ['gift_alice', 'gift_bob'],
      })
    ).rejects.toThrow('gift_insufficient_codes');
    // Nothing was partially allocated by the failed transaction.
    const detail = await service.campaignDetail(imported.campaignId);
    expect(detail.codes.every((row) => row.status === 'available')).toBe(true);
  });

  it('grants an extra code even to a user who already holds one', async () => {
    const aliceId = userIds[0];
    const granted = await service.grant({ campaignId: primaryCampaignId!, userid: aliceId });
    expect(granted.code).toBeTruthy();

    const detail = await service.campaignDetail(primaryCampaignId!);
    const aliceRows = detail.codes.filter((row) => row.userid === aliceId);
    expect(aliceRows.length).toBe(2);
    // The granted code becomes alice's pending offer (the earlier one was shown).
    const pending = await service.currentGiftForUser(aliceId);
    expect(pending?.codeId).toBe(granted.codeId);
  });

  it('requires recipients to resolve before allocating', async () => {
    const byName = await service.allocate({
      campaignId: primaryCampaignId!,
      usernames: ['nobody_here'],
    });
    expect(byName.allocated).toBe(0);
    expect(byName.unknownUsernames).toEqual(['nobody_here']);

    const byId = await service.allocate({
      campaignId: primaryCampaignId!,
      userids: [randomUUID()],
    });
    expect(byId.allocated).toBe(0);
    expect(byId.unknownUserids.length).toBe(1);

    // A mistyped campaign id must fail loudly even when every recipient is
    // unknown — a silent zero-allocation success would mask the typo.
    expect(
      service.allocate({
        campaignId: randomUUID(),
        usernames: ['nobody_here'],
      })
    ).rejects.toThrow('gift_campaign_not_found');
  });
});
