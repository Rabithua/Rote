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
  // dave and eve stay code-less through the first import so later tests can
  // exercise duplicate-code conflicts and expiry without leftover pending
  // gifts from earlier cases.
  const usernames = ['gift_alice', 'gift_bob', 'gift_carol', 'gift_dave', 'gift_eve'];
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

  it('imports paired codes with dedupe and audit description', async () => {
    const [aliceId, bobId, carolId] = userIds;
    const first = await importTestCodes({
      name: 'push-thanks-2026-11',
      title: 'A thank-you gift',
      description: 'Thanks for keeping notifications on.',
      createdBy: adminId,
      codes: [
        { code: 'ROTE-AAA1', expiresAt: futureDate(30), userid: aliceId },
        { code: 'ROTE-BBB2', expiresAt: futureDate(30), userid: bobId },
        { code: 'ROTE-CCC3', expiresAt: futureDate(45), userid: carolId },
      ],
    });
    expect(first.imported).toBe(3);
    expect(first.duplicateCodes).toBe(0);
    expect(first.skippedUserids).toEqual([]);
    expect(first.totalCodes).toBe(3);

    // Re-importing an already-present code string for a fresh recipient loses
    // the unique-code conflict; a code for a recipient who already holds one
    // is skipped and reported.
    const daveId = userIds[3];
    const second = await importTestCodes({
      name: 'push-thanks-2026-11',
      codes: [{ code: 'ROTE-BBB2', expiresAt: futureDate(30), userid: daveId }],
    });
    expect(second.imported).toBe(0);
    expect(second.duplicateCodes).toBe(1);
    expect(second.skippedUserids).toEqual([]);
    expect(second.totalCodes).toBe(3);

    const third = await importTestCodes({
      name: 'push-thanks-2026-11',
      codes: [{ code: 'ROTE-DDD4', expiresAt: futureDate(45), userid: aliceId }],
    });
    expect(third.imported).toBe(0);
    expect(third.duplicateCodes).toBe(0);
    expect(third.skippedUserids).toEqual([aliceId]);
    expect(third.totalCodes).toBe(3);
    primaryCampaignId = third.campaignId;

    const detail = await service.campaignDetail(primaryCampaignId);
    expect(detail.campaign.status).toBe('allocated');
  });

  it('rejects expired, malformed, or unknown-recipient imports', async () => {
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: 'ROTE-OLD', expiresAt: new Date(Date.now() - 1000), userid: userIds[0] }],
      })
    ).rejects.toThrow('gift_invalid_request');
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: '', expiresAt: futureDate(1), userid: userIds[0] }],
      })
    ).rejects.toThrow('gift_invalid_request');
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: 'ROTE-BADID', expiresAt: futureDate(1), userid: 'not-a-uuid' }],
      })
    ).rejects.toThrow('gift_invalid_request');
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [{ code: 'ROTE-GHOST', expiresAt: futureDate(1), userid: randomUUID() }],
      })
    ).rejects.toThrow('gift_invalid_request');
    // The same code pointed at two recipients is a caller data conflict:
    // refuse it instead of silently dropping one of the listed recipients.
    expect(
      importTestCodes({
        name: 'expired-import',
        codes: [
          { code: 'ROTE-TWIN', expiresAt: futureDate(1), userid: userIds[0] },
          { code: 'ROTE-TWIN', expiresAt: futureDate(1), userid: userIds[1] },
        ],
      })
    ).rejects.toThrow('gift_invalid_request');
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
    const eveId = userIds[4];
    const imported = await importTestCodes({
      name: 'short-window',
      codes: [{ code: 'ROTE-SOON', expiresAt: futureDate(1), userid: eveId }],
    });
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
    expect(await service.currentGiftForUser(eveId)).toBeNull();

    const status = await service.campaignStatus(imported.campaignId);
    expect(status.totals.expired).toBe(1);
    expect(status.totals.allocatedActive).toBe(0);
    expect(status.totals.shown).toBe(0);
    expect(status.totals.total).toBe(1);
  });

  it('delivers multiple codes for one recipient from a single import in order', async () => {
    const aliceId = userIds[0];
    const imported = await importTestCodes({
      name: 'double-gift',
      codes: [
        { code: 'ROTE-D1', expiresAt: futureDate(10), userid: aliceId },
        { code: 'ROTE-D2', expiresAt: futureDate(20), userid: aliceId },
      ],
    });
    expect(imported.imported).toBe(2);
    expect(imported.skippedUserids).toEqual([]);

    const detail = await service.campaignDetail(imported.campaignId);
    expect(detail.codes.filter((row) => row.userid === aliceId).length).toBe(2);

    // The earlier allocation surfaces first; showing it reveals the next.
    const firstOffer = await service.currentGiftForUser(aliceId);
    expect(firstOffer).not.toBeNull();
    expect(await service.markShown(firstOffer!.codeId, aliceId)).toBe('marked');
    const secondOffer = await service.currentGiftForUser(aliceId);
    expect(secondOffer).not.toBeNull();
    expect(secondOffer!.codeId).not.toBe(firstOffer!.codeId);
  });
});
